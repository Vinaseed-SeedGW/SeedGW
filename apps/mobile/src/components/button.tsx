import { Pressable, StyleSheet } from 'react-native';
import { Text } from './text';
import { COLORS, FONT, SPACE } from '../theme';

type Variant = 'primary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, VARIANT_STYLES[variant], pressed && styles.pressed]}
    >
      <Text style={[styles.text, variant === 'ghost' ? styles.textGhost : null]}>{label}</Text>
    </Pressable>
  );
}

const VARIANT_STYLES = StyleSheet.create({
  primary: { backgroundColor: COLORS.brand },
  ghost: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  danger: { backgroundColor: COLORS.danger },
});

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    minWidth: 88,
    paddingHorizontal: SPACE.lg,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  text: { color: COLORS.onBrand, fontSize: 16, fontWeight: FONT.bold },
  textGhost: { color: COLORS.text },
});
