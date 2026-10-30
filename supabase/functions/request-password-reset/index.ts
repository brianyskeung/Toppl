// Sends a password reset to a username account's recovery email, if it has one.
// Always answers the same way, so it never reveals whether an account or email exists.
import { adminClient, anonClient, json, readJson } from '../_shared/http.ts';
import { allowAttempt, clientIp } from '../_shared/rate-limit.ts';
import { normalizeUsername } from '../_shared/validation.ts';

const RESPONSE = {
  message: 'If that account has a recovery email, a reset link is on its way.',
};
const REDIRECT_TO = Deno.env.get('PASSWORD_RESET_REDIRECT_URL') ?? 'toppl://reset-password';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const admin = adminClient();
  const username = normalizeUsername((await readJson(req)).username);

  const allowed = (await allowAttempt(admin, clientIp(req), 'reset', 10, '1 hour')) &&
    (await allowAttempt(admin, `user:${username}`, 'reset', 3, '1 hour'));
  if (!allowed) return json({ error: 'Too many attempts. Try again later.' }, 429);

  const { data: profile } = username
    ? await admin.from('profiles').select('id').eq('username', username).maybeSingle()
    : { data: null };
  const { data: login } = profile
    ? await admin.from('username_logins').select('auth_email').eq('user_id', profile.id)
      .maybeSingle()
    : { data: null };

  if (login && !login.auth_email.endsWith('.invalid')) {
    const { error } = await anonClient().auth.resetPasswordForEmail(login.auth_email, {
      redirectTo: REDIRECT_TO,
    });
    // Logged without the address; the caller still gets the uniform response.
    if (error) console.error('resetPasswordForEmail failed', error.status, error.code);
  }
  return json(RESPONSE);
});
