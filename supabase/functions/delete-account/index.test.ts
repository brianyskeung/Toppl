import { deepStrictEqual as assertEquals } from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import {
  admin,
  ANON_KEY,
  API_URL,
  callFunction,
  deleteUserByUsername,
  randomUsername,
} from '../_shared/test-utils.ts';

const PASSWORD = 'correct-horse';

Deno.test('deletes the caller with their profile, login mapping and avatars', async () => {
  const username = randomUsername();
  try {
    await callFunction('sign-up-username', { username, password: PASSWORD });
    const tokens = (await callFunction('sign-in-username', { username, password: PASSWORD })).body;
    const user = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data: session } = await user.auth.setSession(tokens);
    const id = session.user!.id;
    await user.storage.from('avatars').upload(`${id}/a.jpg`, new Uint8Array([1, 2, 3]), {
      contentType: 'image/jpeg',
    });
    await user.from('profile_private').insert({ id, height_cm: 170 });

    const res = await callFunction('delete-account', {}, { token: tokens.access_token });
    assertEquals(res.status, 200);

    const counts = await Promise.all([
      admin.from('profiles').select('id', { count: 'exact', head: true }).eq('id', id),
      admin.from('profile_private').select('id', { count: 'exact', head: true }).eq('id', id),
      admin.from('username_logins').select('user_id', { count: 'exact', head: true }).eq(
        'user_id',
        id,
      ),
    ]);
    assertEquals(counts.map((c) => c.count), [0, 0, 0]);
    assertEquals((await admin.auth.admin.getUserById(id)).data.user, null);
    assertEquals((await admin.storage.from('avatars').list(id)).data, []);

    // The username is free again.
    assertEquals(
      (await callFunction('sign-up-username', { username, password: PASSWORD })).status,
      201,
    );
  } finally {
    await deleteUserByUsername(username);
  }
});

Deno.test('rejects calls without a valid user token', async () => {
  assertEquals((await callFunction('delete-account', {}, { token: '' })).status, 401);
  assertEquals((await callFunction('delete-account', {}, { token: 'not-a-jwt' })).status, 401);
  // The anon key is a valid JWT but has no user.
  assertEquals((await callFunction('delete-account', {})).status, 401);
});
