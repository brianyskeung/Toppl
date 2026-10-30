import * as Linking from 'expo-linking';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { changePassword, parseRecoveryLink, startRecoverySession } from '@/features/identity/auth';
import { NewPasswordForm } from '@/features/identity/components/NewPasswordForm';

/** Opened from the password-reset email. Outside the route guards, since it signs the user in. */
export default function ResetPassword() {
  const url = Linking.useLinkingURL();
  const link = useMemo(() => (url ? parseRecoveryLink(url) : null), [url]);
  const [session, setSession] = useState<'loading' | 'ready' | { error: string }>('loading');

  useEffect(() => {
    if (!link?.tokens) return;
    startRecoverySession(link.tokens).then(
      () => setSession('ready'),
      (e: Error) => setSession({ error: e.message }),
    );
  }, [link]);

  const state = link?.error ? { error: link.error } : session;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: 'Set a new password' }} />
      {state === 'loading' ? <ActivityIndicator /> : null}
      {typeof state === 'object' ? <Text>{state.error}</Text> : null}
      {state === 'ready' ? (
        <NewPasswordForm
          submitLabel="Save new password"
          onSubmit={async (password) => {
            await changePassword(password);
            router.replace('/');
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, padding: 24, gap: 12 } });
