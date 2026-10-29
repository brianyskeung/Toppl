import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
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

/** Native Sign in with Apple (iOS only). Returns false if the user cancelled. */
export async function signInWithApple() {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new AuthFormError('Apple sign-in failed. Try again.');
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) throw new AuthFormError('Apple sign-in failed. Try again.');
    return true;
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false;
    throw e instanceof AuthFormError ? e : new AuthFormError('Apple sign-in failed. Try again.');
  }
}

/** Native Google sign-in. Returns false if the user dismissed the Google dialog. */
export async function signInWithGoogle() {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
  try {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return false;
    if (!response.data.idToken) throw new AuthFormError('Google sign-in failed. Try again.');
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: response.data.idToken,
    });
    if (error) throw new AuthFormError('Google sign-in failed. Try again.');
    return true;
  } catch (e) {
    throw e instanceof AuthFormError ? e : new AuthFormError('Google sign-in failed. Try again.');
  }
}

export async function requestPasswordReset(username: string) {
  const { message } = await invoke<{ message: string }>('request-password-reset', { username });
  return message;
}

export async function changePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new AuthFormError(error.message, 'password');
}

/** Sends a confirmation link; once confirmed the address replaces the account's auth email. */
export async function setRecoveryEmail(email: string) {
  const { error } = await supabase.auth.updateUser({ email });
  if (error) throw new AuthFormError(error.message);
}

/** Reads the session tokens (or error) Supabase puts in the fragment of a recovery link. */
export function parseRecoveryLink(url: string) {
  const params = new URLSearchParams(url.split('#')[1] ?? '');
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) return { tokens: { access_token, refresh_token } };
  return { error: params.get('error_description') ?? 'This reset link is invalid.' };
}

export async function startRecoverySession(tokens: {
  access_token: string;
  refresh_token: string;
}) {
  const { error } = await supabase.auth.setSession(tokens);
  if (error) throw new AuthFormError('This reset link has expired. Request a new one.');
}
