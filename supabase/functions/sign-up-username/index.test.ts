import { deepStrictEqual as assertEquals, ok as assert } from 'node:assert/strict';
import {
  admin,
  callFunction,
  deleteUserByUsername,
  randomIp,
  randomUsername,
} from '../_shared/test-utils.ts';

const PASSWORD = 'correct-horse';

Deno.test('creates auth user, profile and login mapping without exposing the email', async () => {
  const username = randomUsername();
  const res = await callFunction('sign-up-username', { username, password: PASSWORD });
  try {
    assertEquals(res.status, 201);
    assert(!res.text.includes('toppl.invalid'), 'response must not contain the auth email');

    const { data: profile } = await admin.from('profiles').select('id').eq('username', username)
      .single();
    const { data: login } = await admin
      .from('username_logins')
      .select('auth_email')
      .eq('user_id', profile!.id)
      .single();
    assertEquals(login!.auth_email, `${profile!.id}@users.toppl.invalid`);
    const { data: user } = await admin.auth.admin.getUserById(profile!.id);
    assert(user.user?.email_confirmed_at, 'auth user is pre-confirmed');
  } finally {
    await deleteUserByUsername(username);
  }
});

Deno.test('stores the username lowercase', async () => {
  const username = randomUsername();
  const res = await callFunction('sign-up-username', {
    username: username.toUpperCase(),
    password: PASSWORD,
  });
  try {
    assertEquals(res.status, 201);
    assertEquals(res.body.username, username);
  } finally {
    await deleteUserByUsername(username);
  }
});

Deno.test('rejects a taken username case-insensitively', async () => {
  const username = randomUsername();
  await callFunction('sign-up-username', { username, password: PASSWORD });
  try {
    const res = await callFunction('sign-up-username', {
      username: username.toUpperCase(),
      password: PASSWORD,
    });
    assertEquals(res.status, 400);
    assertEquals(res.body.field, 'username');
  } finally {
    await deleteUserByUsername(username);
  }
});

Deno.test('rejects invalid usernames and weak passwords with field errors', async () => {
  const badName = await callFunction('sign-up-username', {
    username: 'no spaces!',
    password: PASSWORD,
  });
  assertEquals(badName.status, 400);
  assertEquals(badName.body.field, 'username');

  const weak = await callFunction('sign-up-username', {
    username: randomUsername(),
    password: 'short',
  });
  assertEquals(weak.status, 400);
  assertEquals(weak.body.field, 'password');
});

Deno.test('rate limits sign-ups per IP', async () => {
  const ip = randomIp();
  const statuses: number[] = [];
  for (let i = 0; i < 6; i++) {
    // Invalid input still counts as an attempt, so nothing is created.
    statuses.push(
      (await callFunction('sign-up-username', { username: 'x', password: 'x' }, { ip })).status,
    );
  }
  assertEquals(statuses.slice(0, 5), [400, 400, 400, 400, 400]);
  assertEquals(statuses[5], 429);
});
