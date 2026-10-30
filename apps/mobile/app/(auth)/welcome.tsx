import { Link, router, Stack } from 'expo-router';
import { Button, StyleSheet, Text, View } from 'react-native';
import { AppleSignInButton } from '@/features/identity/components/AppleSignInButton';
import { GoogleSignInButton } from '@/features/identity/components/GoogleSignInButton';

export default function Welcome() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Welcome to toppl' }} />
      <Text style={styles.lead}>Sign in to set, log and follow climbs.</Text>
      <AppleSignInButton />
      <GoogleSignInButton />
      <Link href="/username" asChild>
        <Button title="Continue with username" />
      </Link>
      <Button title="Not now" onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12, justifyContent: 'center' },
  lead: { fontSize: 16, textAlign: 'center', marginBottom: 12 },
});
