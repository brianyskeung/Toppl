import { supabase } from '@/lib/supabase';
import {
  bodyMeasurementsSchema,
  onboardingSchema,
  profileUpdateSchema,
  type BodyMeasurementsInput,
  type OnboardingInput,
  type ProfileUpdate,
} from './schemas';

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

export async function updateProfile(userId: string, input: ProfileUpdate) {
  const values = profileUpdateSchema.parse(input);
  const { data, error } = await supabase
    .from('profiles')
    .update(values)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Owner-only height and ape index (RLS hides other users' rows). */
export async function fetchBodyMeasurements(userId: string) {
  const { data, error } = await supabase
    .from('profile_private')
    .select('height_cm, ape_index_cm')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveBodyMeasurements(userId: string, input: BodyMeasurementsInput) {
  const values = bodyMeasurementsSchema.parse(input);
  const { error } = await supabase.from('profile_private').upsert({ id: userId, ...values });
  if (error) throw error;
}
