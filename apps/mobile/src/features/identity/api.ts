import { supabase } from '@/lib/supabase';

const PUBLIC_PROFILE_COLUMNS = 'id, username, display_name, avatar_path, bio, grade_system';

export async function fetchProfileByUsername(username: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_COLUMNS)
    .eq('username', username.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type PublicProfile = NonNullable<Awaited<ReturnType<typeof fetchProfileByUsername>>>;

export function avatarUrl(path: string) {
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}
