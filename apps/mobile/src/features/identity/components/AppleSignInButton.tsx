import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { AuthFormError, signInWithApple } from '../auth';

/** Renders nothing on Android or where Apple sign-in is unavailable. */
export function AppleSignInButton() {
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setAvailable);
  }, []);

  if (!available) return null;
  return (
    <>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={8}
        style={styles.button}
        onPress={() => {
          setError(null);
          signInWithApple().catch((e) =>
            setError(e instanceof AuthFormError ? e.message : 'Apple sign-in failed.'),
          );
        }}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  button: { height: 44 },
  error: { color: '#b00020', textAlign: 'center' },
});
