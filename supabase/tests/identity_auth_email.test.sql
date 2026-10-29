begin;
select plan(3);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001@users.toppl.invalid'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@example.com');
insert into public.username_logins (user_id, auth_email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001@users.toppl.invalid');

update auth.users set email = 'climber@example.com' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is(
  (select auth_email from public.username_logins where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'climber@example.com',
  'confirmed email change updates the login mapping');

update auth.users set email = 'other@example.com' where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select is((select count(*)::int from public.username_logins where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 0,
  'users without a username login are unaffected');

update auth.users set phone = '123' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is(
  (select auth_email from public.username_logins where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'climber@example.com',
  'other updates leave the mapping alone');

select * from finish();
rollback;
