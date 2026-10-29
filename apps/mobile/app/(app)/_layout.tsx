import { Link, Stack } from 'expo-router';
import { Button } from 'react-native';
import { signOut } from '@/features/identity/auth';
import { useSession } from '@/features/identity/session';

function AuthButton() {
  const { session } = useSession();
  // shortcut: temporary sign-out here until settings/account exists (Task 17).
  if (session) return <Button title="Sign out" onPress={() => signOut()} />;
  return (
    <Link href="/welcome" asChild>
      <Button title="Sign in" />
    </Link>
  );
}

export default function AppLayout() {
  return <Stack screenOptions={{ headerRight: () => <AuthButton /> }} />;
}
