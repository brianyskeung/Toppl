import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '@/lib/supabase';
import { AuthFormError, signInWithApple } from '../auth';

jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithIdToken: jest.fn() } },
}));
jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
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
