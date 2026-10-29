import { Stack } from 'expo-router';
import { Button, ScrollView, StyleSheet, Text } from 'react-native';
import { changePassword, signOut } from '@/features/identity/auth';
import { NewPasswordForm } from '@/features/identity/components/NewPasswordForm';
import { RecoveryEmailForm } from '@/features/identity/components/RecoveryEmailForm';
import { useSession } from '@/features/identity/session';

export default function Account() {
  const user = useSession().session?.user;
  // Recovery email and password only apply to username/password accounts.
  const isUsernameAccount = user?.app_metadata.provider === 'email';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: 'Account' }} />
      {isUsernameAccount ? (
        <>
          <Text style={styles.heading}>Recovery email</Text>
          <RecoveryEmailForm currentEmail={user?.email} pendingEmail={user?.new_email} />
          <Text style={styles.heading}>Change password</Text>
          <NewPasswordForm submitLabel="Change password" onSubmit={changePassword} />
        </>
      ) : null}
      <Text style={styles.heading}>Session</Text>
      <Button title="Sign out" onPress={() => signOut()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  heading: { fontSize: 18, fontWeight: '600', marginTop: 12 },
});
