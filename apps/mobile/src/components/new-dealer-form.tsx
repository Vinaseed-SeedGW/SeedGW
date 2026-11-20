import { Pressable, StyleSheet, View } from 'react-native';
import {
  DEFAULT_PROPOSED_LEVEL,
  newDealerInput,
  type NewDealerInput,
} from '@seedgw/contracts/dealer-proposals';
import { DEALER_LEVEL_LABEL, DEALER_LEVELS, type DealerLevel } from '@seedgw/contracts/dealers';
import { COLORS, FONT, SPACE } from '../theme';
import { Text, TextInput } from './text';

// Đề xuất đại lý mới tại cửa hàng (M10). Ảnh, toạ độ, giờ lấy từ lượt check-in vừa chụp.

export type NewDealerDraft = {
  name: string;
  phone: string;
  address: string;
  ownerName: string;
  taxCode: string;
  level: DealerLevel;
  note: string;
};

export function emptyNewDealerDraft(address: string | null): NewDealerDraft {
  return {
    name: '',
    phone: '',
    address: address ?? '',
    ownerName: '',
    taxCode: '',
    level: DEFAULT_PROPOSED_LEVEL,
    note: '',
  };
}

/** Kiểm tra như máy chủ. Trả lỗi đầu tiên để hiện cho nhân viên, hoặc dữ liệu đã chuẩn hoá. */
export function validateNewDealer(
  draft: NewDealerDraft,
): { ok: true; data: NewDealerInput } | { ok: false; message: string } {
  const parsed = newDealerInput.safeParse({
    name: draft.name,
    phone: draft.phone,
    address: draft.address,
    ownerName: draft.ownerName,
    taxCode: draft.taxCode,
    level: draft.level,
  });
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, message: parsed.error.issues[0]?.message ?? 'Thông tin đại lý chưa hợp lệ' };
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
  multiline?: boolean;
};

function Field({ label, value, onChange, keyboardType = 'default', multiline }: FieldProps) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        accessibilityLabel={label}
        keyboardType={keyboardType}
        style={[styles.input, multiline && styles.inputMultiline]}
        multiline={multiline}
        autoCapitalize={keyboardType === 'default' ? 'words' : 'none'}
      />
    </>
  );
}

export function NewDealerForm({
  value,
  onChange,
}: {
  value: NewDealerDraft;
  onChange: (next: NewDealerDraft) => void;
}) {
  const set =
    <K extends keyof NewDealerDraft>(key: K) =>
    (next: NewDealerDraft[K]) =>
      onChange({ ...value, [key]: next });
  return (
    <View style={styles.form}>
      <Text style={styles.title}>Đề xuất đại lý mới</Text>
      <Text style={styles.hint}>
        Quản trị đơn vị duyệt rồi đại lý mới hiện trong danh sách đại lý bạn phụ trách. Lượt này
        được lưu như một lượt check-in.
      </Text>
      <Field label="Tên đại lý (bắt buộc)" value={value.name} onChange={set('name')} />
      <Field
        label="Số điện thoại (bắt buộc)"
        value={value.phone}
        onChange={set('phone')}
        keyboardType="phone-pad"
      />
      <Field label="Địa chỉ (bắt buộc)" value={value.address} onChange={set('address')} multiline />
      <Field label="Chủ cửa hàng" value={value.ownerName} onChange={set('ownerName')} />
      <Field
        label="Mã số thuế"
        value={value.taxCode}
        onChange={set('taxCode')}
        keyboardType="number-pad"
      />
      <Text style={styles.label}>Cấp đại lý gợi ý</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {DEALER_LEVELS.map((level) => {
          const selected = level === value.level;
          return (
            <Pressable
              key={level}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange({ ...value, level })}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {DEALER_LEVEL_LABEL[level]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Field label="Ghi chú" value={value.note} onChange={set('note')} multiline />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { padding: SPACE.lg, gap: SPACE.sm },
  title: { fontSize: 17, fontWeight: FONT.bold, color: COLORS.brand },
  hint: { fontSize: 14, color: COLORS.textMuted },
  label: { fontSize: 14, color: COLORS.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  chip: {
    minHeight: 44,
    paddingHorizontal: SPACE.lg,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  chipText: { fontSize: 15, color: COLORS.text },
  chipTextSelected: { color: COLORS.onBrand, fontWeight: FONT.bold },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACE.md,
    fontSize: 16,
    color: COLORS.text,
  },
  inputMultiline: { minHeight: 80, paddingTop: SPACE.sm, textAlignVertical: 'top' },
});
