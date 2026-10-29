-- identity: profiles, private profile data, username logins, auth rate limiting, avatars.

create extension if not exists citext with schema extensions;

create type public.grade_system as enum ('hueco', 'font', 'dankyu');

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  -- citext's ~ is case-insensitive, so the cast keeps stored usernames lowercase.
  username      extensions.citext unique not null check (username::text ~ '^[a-z0-9_]{3,20}$'),
  display_name  text check (char_length(display_name) <= 50),
  avatar_path   text,
  bio           text check (char_length(bio) <= 280),
  grade_system  public.grade_system not null default 'hueco',
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.profile_private (
  id            uuid primary key references public.profiles (id) on delete cascade,
  height_cm     smallint check (height_cm between 100 and 250),
  ape_index_cm  smallint check (ape_index_cm between -30 and 30),
  updated_at    timestamptz not null default now()
);

-- Server-only: current auth email (placeholder or confirmed recovery email) per username account.
create table public.username_logins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  auth_email  text unique not null
);

-- Server-only: sign-up / sign-in attempts per hashed IP, for rate limiting in Edge Functions.
create table public.auth_attempts (
  id          bigint generated always as identity primary key,
  ip_hash     text not null,
  action      text not null,
  created_at  timestamptz not null default now()
);
create index auth_attempts_lookup on public.auth_attempts (ip_hash, action, created_at);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger profile_private_updated_at before update on public.profile_private
  for each row execute function public.set_updated_at();

-- Records an attempt and returns whether it is within the limit.
create function public.record_auth_attempt(p_ip_hash text, p_action text, p_max int, p_window interval)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  recent int;
begin
  delete from public.auth_attempts where created_at < now() - interval '1 day';
  select count(*) into recent from public.auth_attempts
    where ip_hash = p_ip_hash and action = p_action and created_at > now() - p_window;
  insert into public.auth_attempts (ip_hash, action) values (p_ip_hash, p_action);
  return recent < p_max;
end;
$$;
revoke execute on function public.record_auth_attempt from public, anon, authenticated;
grant execute on function public.record_auth_attempt to service_role;

-- RLS
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.username_logins enable row level security;
alter table public.auth_attempts enable row level security;

create policy "profiles are public" on public.profiles
  for select to anon, authenticated using (true);
create policy "users insert own profile" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "users update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "owner reads private profile" on public.profile_private
  for select to authenticated using (id = (select auth.uid()));
create policy "owner inserts private profile" on public.profile_private
  for insert to authenticated with check (id = (select auth.uid()));
create policy "owner updates private profile" on public.profile_private
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

revoke all on public.username_logins, public.auth_attempts from anon, authenticated;

-- Avatars: public read, writes only inside avatars/<uid>/
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);

create policy "avatars are public" on storage.objects
  for select to anon, authenticated using (bucket_id = 'avatars');
create policy "users upload own avatars" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users update own avatars" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users delete own avatars" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
