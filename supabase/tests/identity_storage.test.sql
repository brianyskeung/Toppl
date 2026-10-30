begin;
select plan(4);

insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-000000000001', 'a@users.toppl.invalid');

select ok((select public from storage.buckets where id = 'avatars'), 'avatars bucket is public');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000001", "role": "authenticated"}';
select lives_ok($$insert into storage.objects (bucket_id, name) values ('avatars', 'aaaaaaaa-0000-0000-0000-000000000001/a.jpg')$$,
  'user uploads into own folder');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('avatars', 'bbbbbbbb-0000-0000-0000-000000000002/a.jpg')$$,
  '42501', null, 'user cannot upload into another folder');
reset role;

set local role anon;
select throws_ok($$insert into storage.objects (bucket_id, name) values ('avatars', 'anon/a.jpg')$$,
  '42501', null, 'anon cannot upload');
reset role;

select * from finish();
rollback;
