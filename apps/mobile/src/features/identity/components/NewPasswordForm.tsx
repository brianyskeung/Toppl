import { useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { newPasswordSchema } from '../schemas';

type Props = { onSubmit: (password: string) => Promise<unknown>; submitLabel: string };

export function NewPasswordForm({ onSubmit, submitLabel }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  async function submit() {
    const parsed = newPasswordSchema.safeParse({ password, confirm });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setError(null);
    setStatus('saving');
    try {
      await onSubmit(parsed.data.password);
      setPassword('');
      setConfirm('');
      setStatus('saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change password.');
      setStatus('idle');
    }
  }

  return (
    <View style={styles.form}>
      <TextInput
        style={styles.input}
        placeholder="New password"
        secureTextEntry
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
        accessibilityLabel="New password"
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm new password"
        secureTextEntry
        autoComplete="new-password"
        value={confirm}
        onChangeText={setConfirm}
        accessibilityLabel="Confirm new password"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {status === 'saving' ? (
        <ActivityIndicator />
      ) : (
        <Button title={submitLabel} onPress={submit} />
      )}
      {status === 'saved' ? <Text>Password changed.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  error: { color: '#b00020' },
});
