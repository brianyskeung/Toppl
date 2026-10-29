import { deepStrictEqual as assertEquals, ok as assert } from 'node:assert/strict';
import {
  admin,
  callFunction,
  deleteUserByUsername,
  MAILPIT_URL,
  randomUsername,
} from '../_shared/test-utils.ts';

const PASSWORD = 'correct-horse';

async function messagesTo(email: string): Promise<number> {
  const res = await fetch(
    `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
  );
  return (await res.json()).messages_count ?? 0;
}

Deno.test('same response for unknown, no-recovery-email and recovery-email accounts', async () => {
  const plain = randomUsername();
  const withEmail = randomUsername();
  const email = `${withEmail}@example.com`;
  await callFunction('sign-up-username', { username: plain, password: PASSWORD });
  await callFunction('sign-up-username', { username: withEmail, password: PASSWORD });
  try {
    const { data } = await admin.from('profiles').select('id').eq('username', withEmail).single();
    // Stands in for the user confirming a recovery email; the trigger updates the login mapping.
    await admin.auth.admin.updateUserById(data!.id, { email, email_confirm: true });

    const unknown = await callFunction('request-password-reset', { username: randomUsername() });
    const noEmail = await callFunction('request-password-reset', { username: plain });
    const valid = await callFunction('request-password-reset', { username: withEmail });
    assertEquals([unknown.status, noEmail.status, valid.status], [200, 200, 200]);
    assertEquals(noEmail.text, unknown.text);
    assertEquals(valid.text, unknown.text);
    assert(!valid.text.includes('example.com'), 'response must not contain the email');

    // Mail delivery is async; poll Mailpit briefly.
    let count = 0;
    for (let i = 0; i < 20 && count === 0; i++) {
      await new Promise((r) => setTimeout(r, 250));
      count = await messagesTo(email);
    }
    assertEquals(count, 1);

    // The user still signs in with their username after adding a recovery email.
    const signIn = await callFunction('sign-in-username', {
      username: withEmail,
      password: PASSWORD,
    });
    assertEquals(signIn.status, 200);
  } finally {
    await deleteUserByUsername(plain);
    await deleteUserByUsername(withEmail);
  }
});
