import { deepStrictEqual as assertEquals, ok as assert } from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import {
  ANON_KEY,
  API_URL,
  callFunction,
  deleteUserByUsername,
  randomIp,
  randomUsername,
} from '../_shared/test-utils.ts';

const PASSWORD = 'correct-horse';

async function withUser(fn: (username: string) => Promise<void>) {
  const username = randomUsername();
  const res = await callFunction('sign-up-username', { username, password: PASSWORD });
  assertEquals(res.status, 201);
  try {
    await fn(username);
  } finally {
    await deleteUserByUsername(username);
  }
}

Deno.test('correct credentials return a session the client can use', () =>
  withUser(async (username) => {
    const res = await callFunction('sign-in-username', { username, password: PASSWORD });
    assertEquals(res.status, 200);
    assert(!res.text.includes('toppl.invalid'), 'response must not contain the auth email');

    const client = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data, error } = await client.auth.setSession(res.body);
    assertEquals(error, null);
    assert(data.session);
  }));

Deno.test('wrong password and unknown username return the identical error', () =>
  withUser(async (username) => {
    const wrong = await callFunction('sign-in-username', { username, password: 'wrong-password' });
    const unknown = await callFunction('sign-in-username', {
      username: randomUsername(),
      password: PASSWORD,
    });
    assertEquals(wrong.status, 401);
    assertEquals(unknown.status, 401);
    assertEquals(wrong.text, unknown.text);
  }));

Deno.test('rate limits repeated attempts on one username', () =>
  withUser(async (username) => {
    let last = 0;
    for (let i = 0; i < 11; i++) {
      last = (await callFunction('sign-in-username', { username, password: 'nope-nope' }, {
        ip: randomIp(),
      }))
        .status;
    }
    assertEquals(last, 429);
  }));
