import { Stack } from 'expo-router';
import { useMyProfile } from '@/features/identity/hooks';

export default function OnboardingLayout() {
  // Username/password accounts already have a profile, so they skip straight to the profile step.
  const hasProfile = !!useMyProfile().data;
  return (
    <Stack screenOptions={{ headerBackVisible: false, gestureEnabled: false }}>
      <Stack.Protected guard={!hasProfile}>
        <Stack.Screen name="username" />
      </Stack.Protected>
      <Stack.Protected guard={hasProfile}>
        <Stack.Screen name="profile" />
      </Stack.Protected>
    </Stack>
  );
}
