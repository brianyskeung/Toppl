// Signs in with username + password. Every failure returns the same generic 401.
import { adminClient, anonClient, json, readJson } from '../_shared/http.ts';
import { allowAttempt, clientIp } from '../_shared/rate-limit.ts';
import { normalizeUsername } from '../_shared/validation.ts';

const INVALID = { error: 'Invalid username or password.' };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const admin = adminClient();
  const body = await readJson(req);
  const username = normalizeUsername(body.username);

  // Per-IP limit plus a per-username limit, so one account can't be brute-forced from many IPs.
  const allowed = (await allowAttempt(admin, clientIp(req), 'sign_in', 20, '10 minutes')) &&
    (await allowAttempt(admin, `user:${username}`, 'sign_in', 10, '10 minutes'));
  if (!allowed) return json({ error: 'Too many attempts. Try again later.' }, 429);

  if (!username || typeof body.password !== 'string') return json(INVALID, 401);

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  const { data: login } = profile
    ? await admin.from('username_logins').select('auth_email').eq('user_id', profile.id)
      .maybeSingle()
    : { data: null };
  if (!login) return json(INVALID, 401);

  const { data, error } = await anonClient().auth.signInWithPassword({
    email: login.auth_email,
    password: body.password,
  });
  if (error || !data.session) return json(INVALID, 401);

  // Only the tokens: the session's user object carries the auth email.
  return json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
});
