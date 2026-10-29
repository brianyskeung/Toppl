import { supabase } from '@/lib/supabase';
import { onboardingSchema, type OnboardingInput } from './schemas';

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

export async function fetchMyProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type MyProfile = NonNullable<Awaited<ReturnType<typeof fetchMyProfile>>>;

export async function completeOnboarding(userId: string, input: OnboardingInput) {
  const values = onboardingSchema.parse(input);
  const { error } = await supabase
    .from('profiles')
    .update({ ...values, onboarded_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}
