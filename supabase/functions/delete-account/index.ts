// Deletes the calling user's account: avatar files, then the auth user (profile rows cascade).
import { adminClient, anonClient, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  const { data, error } = token
    ? await anonClient().auth.getUser(token)
    : { data: null, error: true };
  const userId = data?.user?.id;
  if (error || !userId) return json({ error: 'Unauthorized' }, 401);

  const admin = adminClient();
  const avatars = admin.storage.from('avatars');
  const { data: files, error: listError } = await avatars.list(userId);
  if (listError) return json({ error: 'Could not delete account.' }, 500);
  if (files.length) {
    const { error: removeError } = await avatars.remove(files.map((f) => `${userId}/${f.name}`));
    if (removeError) return json({ error: 'Could not delete account.' }, 500);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) return json({ error: 'Could not delete account.' }, 500);
  return json({ deleted: true });
});
