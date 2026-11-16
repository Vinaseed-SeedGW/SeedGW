import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from './text';
import { login } from '../api/client';
import { COLORS, FONT, SPACE } from '../theme';
import { Button } from './button';
import { AppFooter } from './app-footer';

// M1: cùng tài khoản web. Máy đầu tiên dùng được ngay, máy thứ hai chờ quản trị duyệt.
export function LoginScreen() {
  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!employeeCode.trim() || !password) {
      setError('Nhập mã nhân viên và mật khẩu.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await login(employeeCode.trim(), password);
    setBusy(false);
    // Thành công thì App tự chuyển màn nhờ theo dõi phiên đăng nhập.
    if (!result.ok) setError(result.message);
  }

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>DMS Vinaseed</Text>
        <Text style={styles.title}>Đăng nhập</Text>
        <Text style={styles.muted}>Dùng mã nhân viên và mật khẩu như trên web.</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Mã nhân viên</Text>
          <TextInput
            value={employeeCode}
            onChangeText={setEmployeeCode}
            accessibilityLabel="Mã nhân viên"
            autoCapitalize="characters"
            autoCorrect={false}
            textContentType="username"
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Mật khẩu</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            accessibilityLabel="Mật khẩu"
            secureTextEntry
            textContentType="password"
            onSubmitEditing={() => void submit()}
            style={styles.input}
          />
        </View>
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <Button label={busy ? 'Đang đăng nhập' : 'Đăng nhập'} onPress={() => void submit()} />
        <Text style={styles.muted}>
          Mỗi tài khoản dùng trên một điện thoại. Đổi máy thì nhờ quản trị duyệt máy mới ở mục Tài
          khoản trên web.
        </Text>
        <AppFooter />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: COLORS.surface },
  content: { padding: SPACE.xl, gap: SPACE.md },
  brand: { fontSize: 18, fontWeight: FONT.bold, color: COLORS.brand, marginTop: SPACE.xl },
  title: { fontSize: 24, fontWeight: FONT.bold, color: COLORS.text },
  muted: { fontSize: 14, color: COLORS.textMuted },
  field: { gap: SPACE.xs },
  label: { fontSize: 14, color: COLORS.textMuted },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACE.md,
    fontSize: 16,
    color: COLORS.text,
  },
  error: { fontSize: 14, color: COLORS.danger },
});
