import { useState } from 'react';
import { Button, StyleSheet, Text } from 'react-native';
import { AuthFormError, signInWithGoogle } from '../auth';

export function GoogleSignInButton() {
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button
        title="Continue with Google"
        onPress={() => {
          setError(null);
          signInWithGoogle().catch((e) =>
            setError(e instanceof AuthFormError ? e.message : 'Google sign-in failed.'),
          );
        }}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({ error: { color: '#b00020', textAlign: 'center' } });
