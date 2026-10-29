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

export const gradeSystems = ['hueco', 'font', 'dankyu'] as const;
export const gradeSystemSchema = z.enum(gradeSystems);
export type GradeSystem = z.infer<typeof gradeSystemSchema>;
export const gradeSystemLabels: Record<GradeSystem, string> = {
  hueco: 'Hueco (V-scale)',
  font: 'Fontainebleau',
  dankyu: 'Dankyu',
};

/** Optional text: trimmed, and stored as null when empty. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters.`)
    .transform((v) => v || null);

export const displayNameSchema = optionalText(50, 'Display name');
export const bioSchema = optionalText(280, 'Bio');

export const onboardingSchema = z.object({
  grade_system: gradeSystemSchema,
  display_name: displayNameSchema,
});
export type OnboardingInput = z.input<typeof onboardingSchema>;

export const profileUpdateSchema = z.object({
  display_name: displayNameSchema,
  bio: bioSchema,
  grade_system: gradeSystemSchema,
});
export type ProfileUpdate = z.input<typeof profileUpdateSchema>;

/** Optional whole number typed into a text field: empty means null. */
const optionalInt = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : Number(v)))
    .pipe(
      z
        .number(`${label} must be a number.`)
        .int(`${label} must be a whole number.`)
        .min(min, `${label} must be between ${min} and ${max}.`)
        .max(max, `${label} must be between ${min} and ${max}.`)
        .nullable(),
    );

export const bodyMeasurementsSchema = z.object({
  height_cm: optionalInt(100, 250, 'Height'),
  ape_index_cm: optionalInt(-30, 30, 'Ape index'),
});
export type BodyMeasurementsInput = z.input<typeof bodyMeasurementsSchema>;
