// Mirrors the profiles.username check constraint and the app's Zod schemas.
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
export const PASSWORD_MIN = 8;

export type FieldError = { field: 'username' | 'password'; error: string };

export function normalizeUsername(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

export function validateCredentials(username: string, password: unknown): FieldError | null {
  if (!USERNAME_PATTERN.test(username)) {
    return {
      field: 'username',
      error: 'Username must be 3–20 characters: letters, numbers or underscores.',
    };
  }
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) {
    return { field: 'password', error: `Password must be at least ${PASSWORD_MIN} characters.` };
  }
  if (password.length > 72) {
    // bcrypt ignores bytes past 72.
    return { field: 'password', error: 'Password must be at most 72 characters.' };
  }
  return null;
}
