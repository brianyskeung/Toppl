import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '@/lib/supabase';
import { AuthFormError, parseRecoveryLink, signInWithApple, signInWithGoogle } from '../auth';

jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithIdToken: jest.fn() } },
}));
jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn(), signIn: jest.fn() },
  isSuccessResponse: (r: { type: string }) => r.type === 'success',
}));

const signInWithIdToken = jest.mocked(supabase.auth.signInWithIdToken);
const appleSignIn = jest.mocked(AppleAuthentication.signInAsync);

beforeEach(() => jest.clearAllMocks());

describe('signInWithApple', () => {
  test('exchanges the Apple identity token for a Supabase session', async () => {
    appleSignIn.mockResolvedValue({ identityToken: 'apple-token' } as never);
    signInWithIdToken.mockResolvedValue({ error: null } as never);
    await expect(signInWithApple()).resolves.toBe(true);
    expect(signInWithIdToken).toHaveBeenCalledWith({ provider: 'apple', token: 'apple-token' });
  });

  test('returns false when the user cancels', async () => {
    appleSignIn.mockRejectedValue(
      Object.assign(new Error('canceled'), { code: 'ERR_REQUEST_CANCELED' }),
    );
    await expect(signInWithApple()).resolves.toBe(false);
    expect(signInWithIdToken).not.toHaveBeenCalled();
  });

  test('reports a Supabase failure as a form error', async () => {
    appleSignIn.mockResolvedValue({ identityToken: 'apple-token' } as never);
    signInWithIdToken.mockResolvedValue({ error: new Error('provider disabled') } as never);
    await expect(signInWithApple()).rejects.toBeInstanceOf(AuthFormError);
  });
});

describe('signInWithGoogle', () => {
  const googleSignIn = jest.mocked(GoogleSignin.signIn);

  test('exchanges the Google ID token for a Supabase session', async () => {
    googleSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'google-token' } } as never);
    signInWithIdToken.mockResolvedValue({ error: null } as never);
    await expect(signInWithGoogle()).resolves.toBe(true);
    expect(signInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'google-token' });
  });

  test('returns false without an error when the dialog is cancelled', async () => {
    googleSignIn.mockResolvedValue({ type: 'cancelled', data: null } as never);
    await expect(signInWithGoogle()).resolves.toBe(false);
    expect(signInWithIdToken).not.toHaveBeenCalled();
  });
});

describe('parseRecoveryLink', () => {
  test('reads tokens from the fragment', () => {
    expect(
      parseRecoveryLink('toppl://reset-password#access_token=a&refresh_token=r&type=recovery'),
    ).toEqual({ tokens: { access_token: 'a', refresh_token: 'r' } });
  });

  test('reports an expired link', () => {
    expect(
      parseRecoveryLink(
        'toppl://reset-password#error=access_denied&error_description=Link+expired',
      ),
    ).toEqual({ error: 'Link expired' });
  });

  test('rejects a link without tokens', () => {
    expect(parseRecoveryLink('toppl://reset-password')).toEqual({
      error: 'This reset link is invalid.',
    });
  });
});
