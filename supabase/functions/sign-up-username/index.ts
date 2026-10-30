// Creates a username/password account. The auth email is a hidden, undeliverable placeholder.
import { adminClient, json, readJson } from '../_shared/http.ts';
import { allowAttempt, clientIp } from '../_shared/rate-limit.ts';
import { normalizeUsername, validateCredentials } from '../_shared/validation.ts';

const TAKEN = { field: 'username', error: 'That username is taken.' };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const admin = adminClient();

  if (!(await allowAttempt(admin, clientIp(req), 'sign_up', 5, '1 hour'))) {
    return json({ error: 'Too many attempts. Try again later.' }, 429);
  }

  const body = await readJson(req);
  const username = normalizeUsername(body.username);
  const invalid = validateCredentials(username, body.password);
  if (invalid) return json(invalid, 400);

  const { data: existing, error: lookupError } = await admin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (lookupError) return json({ error: 'Sign-up failed.' }, 500);
  if (existing) return json(TAKEN, 400);

  const id = crypto.randomUUID();
  const authEmail = `${id}@users.toppl.invalid`;
  const { error: createError } = await admin.auth.admin.createUser({
    id,
    email: authEmail,
    password: body.password as string,
    email_confirm: true,
  });
  if (createError) return json({ error: 'Sign-up failed.' }, 500);

  const { error: profileError } = await admin.from('profiles').insert({ id, username });
  const { error: loginError } = profileError
    ? { error: null }
    : await admin.from('username_logins').insert({ user_id: id, auth_email: authEmail });
  if (profileError || loginError) {
    // Deleting the auth user cascades to anything already inserted.
    await admin.auth.admin.deleteUser(id);
    if (profileError?.code === '23505') return json(TAKEN, 400);
    return json({ error: 'Sign-up failed.' }, 500);
  }

  return json({ username }, 201);
});
