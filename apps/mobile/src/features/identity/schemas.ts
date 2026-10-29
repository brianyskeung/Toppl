import { z } from 'zod';

// Mirrors the profiles.username check constraint and supabase/functions/_shared/validation.ts.
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, 'Username must be 3–20 characters: letters, numbers or underscores.');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be at most 72 characters.');

export const credentialsSchema = z.object({ username: usernameSchema, password: passwordSchema });
export type Credentials = z.infer<typeof credentialsSchema>;
