import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';

export const AVATAR_MAX_EDGE = 512;

/** Resize that brings the longest edge down to `max`, or null when the image is already small enough. */
export function avatarResize(width: number, height: number, max = AVATAR_MAX_EDGE) {
  if (Math.max(width, height) <= max) return null;
  return width >= height ? { width: max, height: null } : { width: null, height: max };
}

/**
 * Lets the user pick a photo, uploads a ≤512px JPEG to avatars/<uid>/, points the profile at it
 * and removes the previous file. Returns the new path, or null if the user cancelled.
 */
export async function pickAndUploadAvatar(userId: string, previousPath: string | null) {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
  });
  if (picked.canceled) return null;
  const asset = picked.assets[0];

  const context = ImageManipulator.manipulate(asset.uri);
  const resize = avatarResize(asset.width, asset.height);
  if (resize) context.resize(resize);
  const image = await (
    await context.renderAsync()
  ).saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.8,
  });

  const path = `${userId}/${Date.now()}.jpg`;
  const body = await (await fetch(image.uri)).arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, body, { contentType: 'image/jpeg' });
  if (uploadError) throw uploadError;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_path: path })
    .eq('id', userId);
  if (updateError) {
    await supabase.storage.from('avatars').remove([path]);
    throw updateError;
  }

  // The profile already points at the new file, so a failed cleanup only leaves an orphan.
  if (previousPath) await supabase.storage.from('avatars').remove([previousPath]);
  return path;
}
