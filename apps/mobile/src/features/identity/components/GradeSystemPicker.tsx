import { Pressable, StyleSheet, Text, View } from 'react-native';
import { gradeSystemLabels, gradeSystems, type GradeSystem } from '../schemas';

type Props = { value: GradeSystem | null; onChange: (value: GradeSystem) => void };

export function GradeSystemPicker({ value, onChange }: Props) {
  return (
    <View accessibilityRole="radiogroup" style={styles.group}>
      {gradeSystems.map((system) => {
        const selected = value === system;
        return (
          <Pressable
            key={system}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(system)}
            style={[styles.option, selected && styles.selected]}
          >
            <Text>{gradeSystemLabels[system]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  option: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  selected: { borderColor: '#1565c0', backgroundColor: '#e3f2fd' },
});
