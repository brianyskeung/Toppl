import { Stack } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { ProfileForm } from '@/features/identity/components/ProfileForm';
import { useMyProfile, useUpdateProfile } from '@/features/identity/hooks';

export default function EditProfile() {
  const { data: profile } = useMyProfile();
  const update = useUpdateProfile();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: 'Edit profile' }} />
      {profile ? (
        <ProfileForm initial={profile} onSubmit={update.mutateAsync} />
      ) : (
        <ActivityIndicator />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ container: { padding: 16, gap: 16 } });
