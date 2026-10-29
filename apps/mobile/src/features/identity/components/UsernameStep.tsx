import { useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { usernameSchema } from '../schemas';

type Props = { onSubmit: (username: string) => Promise<unknown> };

export function UsernameStep({ onSubmit }: Props) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = usernameSchema.safeParse(username);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setError(null);
    setBusy(true);
    try {
      await onSubmit(parsed.data);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Could not save. Try again.');
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Choose a username</Text>
      <TextInput
        style={styles.input}
        placeholder="Username"
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
        accessibilityLabel="Username"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy ? <ActivityIndicator /> : <Button title="Continue" onPress={submit} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  heading: { fontSize: 18, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  error: { color: '#b00020' },
});
