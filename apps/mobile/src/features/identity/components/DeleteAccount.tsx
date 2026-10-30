import { useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = { username: string; onDelete: () => Promise<unknown> };

/** Deletion only unlocks once the user types their username. */
export function DeleteAccount({ username, onDelete }: Props) {
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const confirmed = typed.trim().toLowerCase() === username.toLowerCase();

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await onDelete();
    } catch {
      setError('Could not delete your account. Try again.');
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text>
        This permanently deletes your account, profile and photos. Type{' '}
        <Text style={styles.bold}>{username}</Text> to confirm.
      </Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        value={typed}
        onChangeText={setTyped}
        accessibilityLabel="Type your username to confirm"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy ? (
        <ActivityIndicator />
      ) : (
        <Button title="Delete account" color="#b00020" disabled={!confirmed} onPress={remove} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  bold: { fontWeight: '600' },
  error: { color: '#b00020' },
});
