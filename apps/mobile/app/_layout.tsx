import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { SessionProvider, useSession } from '@/features/identity/session';
import { queryClient } from '@/lib/query-client';

function RootStack() {
  const { session, isLoading } = useSession();
  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(app)" />
      {/* Signing in removes the auth screens, returning the user to where they were. */}
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" options={{ presentation: 'modal' }} />
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
