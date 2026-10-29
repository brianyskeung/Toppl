-- Local dev seed: two username accounts, both with password "password123".
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   '11111111-1111-1111-1111-111111111111@users.toppl.invalid', extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
   '22222222-2222-2222-2222-222222222222@users.toppl.invalid', extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, 'email', jsonb_build_object('sub', id::text, 'email', email), now(), now(), now()
from auth.users where email like '%@users.toppl.invalid';

insert into public.profiles (id, username, display_name, bio, grade_system, onboarded_at) values
  ('11111111-1111-1111-1111-111111111111', 'sam_sends', 'Sam', 'Board sessions after work.', 'hueco', now()),
  ('22222222-2222-2222-2222-222222222222', 'crimp_queen', 'Robin', null, 'font', now());

insert into public.username_logins (user_id, auth_email)
select id, email from auth.users where email like '%@users.toppl.invalid';
