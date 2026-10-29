import { Link, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { AuthFormError, signInWithUsername, signUpWithUsername } from '@/features/identity/auth';
import { credentialsSchema } from '@/features/identity/schemas';

type Mode = 'sign-up' | 'sign-in';
type Errors = { username?: string; password?: string; form?: string };

export default function UsernameAuth() {
  const [mode, setMode] = useState<Mode>('sign-up');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = credentialsSchema.safeParse({ username, password });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        next[issue.path[0] as 'username' | 'password'] ??= issue.message;
      }
      return setErrors(next);
    }
    setErrors({});
    setBusy(true);
    try {
      // On success the session changes and the auth screens close themselves.
      await (mode === 'sign-up' ? signUpWithUsername : signInWithUsername)(parsed.data);
    } catch (e) {
      const err =
        e instanceof AuthFormError ? e : new AuthFormError('Something went wrong. Try again.');
      setErrors({ [err.field ?? 'form']: err.message });
    } finally {
      setBusy(false);
    }
  }

  const signingUp = mode === 'sign-up';
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: signingUp ? 'Create account' : 'Sign in' }} />
      <TextInput
        style={styles.input}
        placeholder="Username"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        value={username}
        onChangeText={setUsername}
        accessibilityLabel="Username"
      />
      {errors.username ? <Text style={styles.error}>{errors.username}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        autoComplete={signingUp ? 'new-password' : 'current-password'}
        value={password}
        onChangeText={setPassword}
        accessibilityLabel="Password"
      />
      {errors.password ? <Text style={styles.error}>{errors.password}</Text> : null}
      {errors.form ? <Text style={styles.error}>{errors.form}</Text> : null}
      {signingUp ? (
        <Text style={styles.note}>
          No email needed. Without a recovery email (you can add one later in settings), a forgotten
          password can&apos;t be recovered.
        </Text>
      ) : null}
      {busy ? (
        <ActivityIndicator />
      ) : (
        <Button title={signingUp ? 'Create account' : 'Sign in'} onPress={submit} />
      )}
      {signingUp ? null : (
        <Link href="/forgot-password" asChild>
          <Button title="Forgot password?" />
        </Link>
      )}
      <Button
        title={signingUp ? 'I already have an account' : 'Create a new account'}
        onPress={() => {
          setErrors({});
          setMode(signingUp ? 'sign-in' : 'sign-up');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  error: { color: '#b00020' },
  note: { color: '#555', marginVertical: 8 },
});
