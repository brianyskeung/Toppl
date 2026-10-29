import { ActivityIndicator, Button, Image, StyleSheet, Text, View } from 'react-native';
import { avatarUrl } from '../api';
import { useChangeAvatar } from '../hooks';

export function AvatarPicker({ path }: { path: string | null }) {
  const change = useChangeAvatar();
  return (
    <View style={styles.container}>
      {path ? (
        <Image
          source={{ uri: avatarUrl(path) }}
          style={styles.avatar}
          accessibilityLabel="Your avatar"
        />
      ) : (
        <View style={[styles.avatar, styles.placeholder]} />
      )}
      {change.isPending ? (
        <ActivityIndicator />
      ) : (
        <Button title={path ? 'Change photo' : 'Add photo'} onPress={() => change.mutate(path)} />
      )}
      {change.isError ? <Text style={styles.error}>Upload failed. Try again.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 8 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  placeholder: { backgroundColor: '#ddd' },
  error: { color: '#b00020' },
});
