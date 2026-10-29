import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Credentials } from './schemas';

/** An auth failure with a user-facing message and, when known, the field it belongs to. */
export class AuthFormError extends Error {
  constructor(
    message: string,
    readonly field?: 'username' | 'password',
  ) {
    super(message);
  }
}

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) {
    const details =
      error instanceof FunctionsHttpError ? await error.context.json().catch(() => ({})) : {};
    throw new AuthFormError(details.error ?? 'Something went wrong. Try again.', details.field);
  }
  return data as T;
}

export async function signInWithUsername({ username, password }: Credentials) {
  const tokens = await invoke<{ access_token: string; refresh_token: string }>('sign-in-username', {
    username,
    password,
  });
  const { error } = await supabase.auth.setSession(tokens);
  if (error) throw new AuthFormError('Something went wrong. Try again.');
}

export async function signUpWithUsername(credentials: Credentials) {
  await invoke('sign-up-username', { ...credentials });
  await signInWithUsername(credentials);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
