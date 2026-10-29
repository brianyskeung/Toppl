import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { UsernameStep } from '@/features/identity/components/UsernameStep';
import { useCreateProfile } from '@/features/identity/hooks';

export default function OnboardingUsername() {
  const create = useCreateProfile();
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Set up your profile' }} />
      <UsernameStep onSubmit={create.mutateAsync} />
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, padding: 24 } });
