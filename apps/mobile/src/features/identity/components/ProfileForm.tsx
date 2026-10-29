import { useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { profileUpdateSchema, type GradeSystem, type ProfileUpdate } from '../schemas';
import { GradeSystemPicker } from './GradeSystemPicker';

type Props = {
  initial: { display_name: string | null; bio: string | null; grade_system: GradeSystem };
  onSubmit: (values: ProfileUpdate) => Promise<unknown>;
};

type Field = keyof ProfileUpdate;

export function ProfileForm({ initial, onSubmit }: Props) {
  const [displayName, setDisplayName] = useState(initial.display_name ?? '');
  const [bio, setBio] = useState(initial.bio ?? '');
  const [gradeSystem, setGradeSystem] = useState<GradeSystem>(initial.grade_system);
  const [errors, setErrors] = useState<Partial<Record<Field | 'form', string>>>({});
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  async function save() {
    const values = { display_name: displayName, bio, grade_system: gradeSystem };
    const parsed = profileUpdateSchema.safeParse(values);
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

  return (
    <View style={styles.form}>
      <Text>Display name</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        accessibilityLabel="Display name"
      />
      {errors.display_name ? <Text style={styles.error}>{errors.display_name}</Text> : null}
      <Text>Bio</Text>
      <TextInput
        style={[styles.input, styles.bio]}
        value={bio}
        onChangeText={setBio}
        multiline
        accessibilityLabel="Bio"
      />
      {errors.bio ? <Text style={styles.error}>{errors.bio}</Text> : null}
      <Text>Grade system</Text>
      <GradeSystemPicker value={gradeSystem} onChange={setGradeSystem} />
      {errors.form ? <Text style={styles.error}>{errors.form}</Text> : null}
      {status === 'saving' ? <ActivityIndicator /> : <Button title="Save" onPress={save} />}
      {status === 'saved' ? <Text>Saved.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  bio: { minHeight: 80, textAlignVertical: 'top' },
  error: { color: '#b00020' },
});
