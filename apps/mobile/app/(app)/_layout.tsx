import { Link, Stack } from 'expo-router';
import { Button } from 'react-native';
import { useSession } from '@/features/identity/session';

function HeaderButton() {
  const { session } = useSession();
  return session ? (
    <Link href="/settings/account" asChild>
      <Button title="Account" />
    </Link>
  ) : (
    <Link href="/welcome" asChild>
      <Button title="Sign in" />
    </Link>
  );
}

export default function AppLayout() {
  const { session } = useSession();
  return (
    <Stack screenOptions={{ headerRight: () => <HeaderButton /> }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="settings/profile" />
        <Stack.Screen name="settings/body" />
        <Stack.Screen name="settings/account" />
      </Stack.Protected>
    </Stack>
  );
}
