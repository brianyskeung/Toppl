import { useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { bodyMeasurementsSchema, type BodyMeasurementsInput } from '../schemas';

type Field = keyof BodyMeasurementsInput;
type Props = {
  initial: { height_cm: number | null; ape_index_cm: number | null } | null;
  onSubmit: (values: BodyMeasurementsInput) => Promise<unknown>;
};

const toText = (n: number | null | undefined) => (n == null ? '' : String(n));

export function BodyForm({ initial, onSubmit }: Props) {
  const [values, setValues] = useState<BodyMeasurementsInput>({
    height_cm: toText(initial?.height_cm),
    ape_index_cm: toText(initial?.ape_index_cm),
  });
  const [errors, setErrors] = useState<Partial<Record<Field | 'form', string>>>({});
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  async function save() {
    const parsed = bodyMeasurementsSchema.safeParse(values);
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as Field] ??= issue.message;
      return setErrors(next);
    }
    setErrors({});
    setStatus('saving');
    try {
      await onSubmit(values);
      setStatus('saved');
    } catch {
      setErrors({ form: 'Could not save. Try again.' });
      setStatus('idle');
    }
  }

  const field = (name: Field, label: string, hint: string) => (
    <>
      <Text>{label}</Text>
      <TextInput
        style={styles.input}
        value={values[name]}
        onChangeText={(text) => setValues((v) => ({ ...v, [name]: text }))}
        keyboardType="numbers-and-punctuation"
        placeholder={hint}
        accessibilityLabel={label}
      />
      {errors[name] ? <Text style={styles.error}>{errors[name]}</Text> : null}
    </>
  );

  return (
    <View style={styles.form}>
      <Text style={styles.note}>Only you can see these.</Text>
      {field('height_cm', 'Height (cm)', '100–250')}
      {field('ape_index_cm', 'Ape index (cm)', 'Arm span minus height, −30 to 30')}
      {errors.form ? <Text style={styles.error}>{errors.form}</Text> : null}
      {status === 'saving' ? <ActivityIndicator /> : <Button title="Save" onPress={save} />}
      {status === 'saved' ? <Text>Saved.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  error: { color: '#b00020' },
  note: { color: '#555' },
});
