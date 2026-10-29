import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { GradeSystemPicker } from '@/features/identity/components/GradeSystemPicker';
import { useCompleteOnboarding } from '@/features/identity/hooks';
import { onboardingSchema, type GradeSystem } from '@/features/identity/schemas';

export default function OnboardingProfile() {
  const [gradeSystem, setGradeSystem] = useState<GradeSystem | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const complete = useCompleteOnboarding();

  function submit() {
    const parsed = onboardingSchema.safeParse({
      grade_system: gradeSystem,
      display_name: displayName,
    });
    if (!parsed.success) {
      return setError(gradeSystem ? parsed.error.issues[0].message : 'Pick a grade system.');
    }
    setError(null);
    // On success the route guard moves the user into the app.
    complete.mutate(
      { grade_system: parsed.data.grade_system, display_name: displayName },
      { onError: () => setError('Could not save. Try again.') },
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Set up your profile' }} />
      <Text style={styles.heading}>Pick your grade system</Text>
      <GradeSystemPicker value={gradeSystem} onChange={setGradeSystem} />
      <TextInput
        style={styles.input}
        placeholder="Display name (optional)"
        value={displayName}
        onChangeText={setDisplayName}
        accessibilityLabel="Display name"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {complete.isPending ? <ActivityIndicator /> : <Button title="Continue" onPress={submit} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  heading: { fontSize: 18, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  error: { color: '#b00020' },
});
