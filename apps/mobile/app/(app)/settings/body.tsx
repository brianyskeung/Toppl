import { Stack } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { BodyForm } from '@/features/identity/components/BodyForm';
import { useBodyMeasurements, useSaveBodyMeasurements } from '@/features/identity/hooks';

export default function BodyMeasurements() {
  const { data, isPending } = useBodyMeasurements();
  const save = useSaveBodyMeasurements();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: 'Body measurements' }} />
      {isPending ? (
        <ActivityIndicator />
      ) : (
        <BodyForm initial={data ?? null} onSubmit={save.mutateAsync} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ container: { padding: 16 } });
