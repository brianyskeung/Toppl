import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { Button, StyleSheet, Text, View } from 'react-native';
import { useRouteState } from '@/features/identity/hooks';
import { SessionProvider } from '@/features/identity/session';
import { queryClient } from '@/lib/query-client';

function RootStack() {
  const state = useRouteState();
  if (state === 'loading') return null;
  if (state === 'error') {
    return (
      <View style={styles.center}>
        <Text>Couldn&apos;t load your profile.</Text>
        <Button title="Retry" onPress={() => queryClient.refetchQueries()} />
      </View>
    );
  }

  const onboarding = state === 'needs-username' || state === 'needs-onboarding';
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!onboarding}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      {/* Signing in removes the auth screens, returning the user to where they were. */}
      <Stack.Protected guard={state === 'guest'}>
        <Stack.Screen name="(auth)" options={{ presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={onboarding}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RootStack />
      </SessionProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
});
