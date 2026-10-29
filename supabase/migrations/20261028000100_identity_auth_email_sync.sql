-- Keep username_logins.auth_email in step with auth.users.email, so a confirmed recovery email
-- becomes the address used for username sign-in and password resets.

create function public.sync_username_login_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.username_logins set auth_email = new.email where user_id = new.id;
  return new;
end;
$$;
revoke execute on function public.sync_username_login_email from public, anon, authenticated;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (new.email is distinct from old.email and new.email is not null)
  execute function public.sync_username_login_email();
