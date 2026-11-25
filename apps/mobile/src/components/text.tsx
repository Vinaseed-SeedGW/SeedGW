import {
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';
import { FONT_FAMILY, FONT_SCALE } from '../theme';

// Mọi chữ trong app dùng UTM Neo Sans Intel, chỉ 400 và 700 (BRAND.md §2). Font tự nạp mỗi độ đậm là
// một tệp riêng, nên đổi fontWeight 700 thành tệp Bold thay vì để máy tự làm đậm giả.
function brandFont(style: StyleProp<TextStyle>): TextStyle {
  const weight = StyleSheet.flatten(style)?.fontWeight;
  const bold = weight === '700' || weight === 'bold' || weight === 700;
  return { fontFamily: bold ? FONT_FAMILY.bold : FONT_FAMILY.regular, fontWeight: 'normal' };
}

export function Text({ style, maxFontSizeMultiplier = FONT_SCALE.max, ...props }: TextProps) {
  return (
    <NativeText
      {...props}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[style, brandFont(style)]}
    />
  );
}

export function TextInput({
  style,
  maxFontSizeMultiplier = FONT_SCALE.max,
  ...props
}: TextInputProps) {
  return (
    <NativeTextInput
      {...props}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[style, brandFont(style)]}
    />
  );
}
