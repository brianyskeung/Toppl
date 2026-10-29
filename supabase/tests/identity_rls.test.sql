begin;
select plan(25);

-- Fixtures: owner (a) and another user (b), independent of seed data.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@users.toppl.invalid'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@users.toppl.invalid');
insert into public.profiles (id, username) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'owner_a'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'other_b');
insert into public.profile_private (id, height_cm) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 175),
  ('bbbbbbbb-0000-0000-0000-000000000002', 180);
insert into public.username_logins (user_id, auth_email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@users.toppl.invalid');

-- Constraints (as superuser)
select ok(
  (select bool_and(relrowsecurity) from pg_class
   where oid in ('public.profiles'::regclass, 'public.profile_private'::regclass,
                 'public.username_logins'::regclass, 'public.auth_attempts'::regclass)),
  'RLS enabled on every identity table');
select throws_ok($$insert into public.profiles (id, username) values ('aaaaaaaa-0000-0000-0000-000000000009', 'ab')$$,
  '23514', null, 'username shorter than 3 chars rejected');
select throws_ok($$update public.profiles set username = 'Owner_A2' where username = 'owner_a'$$,
  '23514', null, 'uppercase username rejected');
select throws_ok($$update public.profiles set username = 'has-dash' where username = 'owner_a'$$,
  '23514', null, 'invalid characters rejected');
select throws_ok($$update public.profiles set username = 'other_b' where username = 'owner_a'$$,
  '23505', null, 'taken username rejected');
select ok((select 'OWNER_A'::extensions.citext = username from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'username comparison is case-insensitive');
select throws_ok($$update public.profiles set bio = repeat('x', 281) where username = 'owner_a'$$,
  '23514', null, 'bio over 280 chars rejected');
select throws_ok($$update public.profiles set display_name = repeat('x', 51) where username = 'owner_a'$$,
  '23514', null, 'display name over 50 chars rejected');
select throws_ok($$update public.profile_private set height_cm = 300 where height_cm = 175$$,
  '23514', null, 'height out of range rejected');

-- anon
set local role anon;
select is((select count(*)::int from public.profiles where username in ('owner_a', 'other_b')), 2, 'anon reads profiles');
select throws_ok($$insert into public.profiles (id, username) values ('aaaaaaaa-0000-0000-0000-000000000009', 'anon_x')$$,
  '42501', null, 'anon cannot insert profiles');
update public.profiles set bio = 'hacked' where username = 'owner_a';
delete from public.profiles where username = 'owner_a';
reset role;
select is((select bio from public.profiles where username = 'owner_a'), null, 'anon update had no effect');
select is((select count(*)::int from public.profiles where username = 'owner_a'), 1, 'anon delete had no effect');
set local role anon;
select is((select count(*)::int from public.profile_private), 0, 'anon reads no private profiles');
select throws_ok('select * from public.username_logins', '42501', null, 'anon cannot read username_logins');
select throws_ok('select * from public.auth_attempts', '42501', null, 'anon cannot read auth_attempts');
select throws_ok($$select public.record_auth_attempt('x', 'sign_in', 5, '1 minute')$$, '42501', null,
  'anon cannot call record_auth_attempt');
reset role;

-- authenticated as owner a
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000001", "role": "authenticated"}';
update public.profiles set bio = 'mine' where username = 'owner_a';
update public.profiles set bio = 'theirs' where username = 'other_b';
select is((select bio from public.profiles where username = 'owner_a'), 'mine', 'owner updates own profile');
select is((select bio from public.profiles where username = 'other_b'), null, 'owner cannot update another profile');
select results_eq('select height_cm::int from public.profile_private', array[175], 'owner reads only own private row');
update public.profile_private set height_cm = 150 where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select throws_ok($$insert into public.profile_private (id, height_cm) values ('bbbbbbbb-0000-0000-0000-000000000002', 160)$$,
  '42501', null, 'cannot insert private row for another user');
select throws_ok('select * from public.username_logins', '42501', null, 'authenticated cannot read username_logins');
reset role;
select is((select height_cm::int from public.profile_private where id = 'bbbbbbbb-0000-0000-0000-000000000002'), 180,
  'other user private row unchanged');

-- Rate limit function (service role path)
select ok(public.record_auth_attempt('ip1', 'sign_in', 2, '1 minute') and public.record_auth_attempt('ip1', 'sign_in', 2, '1 minute')
  and not public.record_auth_attempt('ip1', 'sign_in', 2, '1 minute'), 'third attempt within window is over the limit');

-- Cascades
delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001')
  + (select count(*)::int from public.profile_private where id = 'aaaaaaaa-0000-0000-0000-000000000001')
  + (select count(*)::int from public.username_logins where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  0, 'deleting auth user cascades to profile, private data and login mapping');

select * from finish();
rollback;
