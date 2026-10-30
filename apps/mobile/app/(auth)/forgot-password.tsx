import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { AuthFormError, requestPasswordReset } from '@/features/identity/auth';

export default function ForgotPassword() {
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!username.trim()) return;
    setBusy(true);
    try {
      setMessage(await requestPasswordReset(username));
    } catch (e) {
      setMessage(e instanceof AuthFormError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Reset password' }} />
      <Text>
        We&apos;ll email a reset link to the recovery email on your account. Accounts without one
        can&apos;t be recovered.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Username"
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
        accessibilityLabel="Username"
      />
      {busy ? <ActivityIndicator /> : <Button title="Send reset link" onPress={submit} />}
      {message ? <Text accessibilityLiveRegion="polite">{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
});
