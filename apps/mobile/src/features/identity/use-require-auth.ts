import { router } from 'expo-router';
import { useCallback } from 'react';
import { useSession } from './session';

/**
 * Wraps a write action: runs it when signed in, otherwise opens the auth sheet.
 * Signing in closes the sheet, so the user lands back on the same screen.
 */
export function useRequireAuth() {
  const { session } = useSession();
  return useCallback(
    <A extends unknown[]>(action: (...args: A) => void) =>
      (...args: A) => {
        if (session) action(...args);
        else router.push('/welcome');
      },
    [session],
  );
}
