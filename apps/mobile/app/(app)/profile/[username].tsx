import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { avatarUrl } from '@/features/identity/api';
import { useProfile } from '@/features/identity/hooks';

export default function ProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { data: profile, isPending, error } = useProfile(username);

  if (isPending) return <ActivityIndicator style={styles.center} />;
  if (error) return <Text style={styles.center}>Couldn&apos;t load this profile.</Text>;
  if (!profile) return <Text style={styles.center}>No climber called @{username}.</Text>;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `@${profile.username}` }} />
      {profile.avatar_path ? (
        <Image
          source={{ uri: avatarUrl(profile.avatar_path) }}
          style={styles.avatar}
          accessibilityLabel={`${profile.username}'s avatar`}
        />
      ) : null}
      <Text style={styles.name}>{profile.display_name ?? profile.username}</Text>
      <Text style={styles.username}>@{profile.username}</Text>
      {profile.bio ? <Text>{profile.bio}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, textAlign: 'center', marginTop: 48 },
  container: { flex: 1, padding: 16, gap: 8, alignItems: 'center' },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  name: { fontSize: 22, fontWeight: '600' },
  username: { color: '#666' },
});
