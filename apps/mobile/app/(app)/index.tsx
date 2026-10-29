import { Link, router, Stack } from 'expo-router';
import { useState } from 'react';
import { Button, StyleSheet, TextInput, View } from 'react-native';
import { useSession } from '@/features/identity/session';

export default function Home() {
  const { session } = useSession();
  const [username, setUsername] = useState('');
  const openProfile = () => {
    const name = username.trim();
    if (name) router.push(`/profile/${encodeURIComponent(name)}`);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'toppl' }} />
      <TextInput
        style={styles.input}
        placeholder="Find a climber by username"
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
        onSubmitEditing={openProfile}
        accessibilityLabel="Username to find"
      />
      <Button title="Open profile" onPress={openProfile} />
      {session ? (
        <Link href="/settings/profile" asChild>
          <Button title="Edit profile" />
        </Link>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
});
