import { useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { setRecoveryEmail } from '../auth';
import { isPlaceholderEmail, recoveryEmailSchema } from '../schemas';

type Props = { currentEmail: string | undefined; pendingEmail: string | undefined };

export function RecoveryEmailForm({ currentEmail, pendingEmail }: Props) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const current = isPlaceholderEmail(currentEmail) ? null : currentEmail;

  async function submit() {
    const parsed = recoveryEmailSchema.safeParse(email);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setError(null);
    setBusy(true);
    try {
      await setRecoveryEmail(parsed.data);
      setMessage(`Check ${parsed.data} for a confirmation link.`);
      setEmail('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update email.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text>Recovery email: {current ?? 'none'}</Text>
      {pendingEmail ? <Text>Waiting for confirmation: {pendingEmail}</Text> : null}
      <Text style={styles.note}>You still sign in with your username.</Text>
      <TextInput
        style={styles.input}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        accessibilityLabel="Recovery email"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy ? (
        <ActivityIndicator />
      ) : (
        <Button title={current ? 'Change recovery email' : 'Add recovery email'} onPress={submit} />
      )}
      {message ? <Text>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  error: { color: '#b00020' },
  note: { color: '#555' },
});
