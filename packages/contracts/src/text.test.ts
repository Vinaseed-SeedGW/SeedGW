import { describe, expect, it } from 'vitest';
import { escapeLikePattern, normalizeSearchText } from './text';

describe('normalizeSearchText', () => {
  it('bo dau tieng Viet va chu hoa', () => {
    expect(normalizeSearchText('  Nguyễn Đức Thắng ')).toBe('nguyen duc thang');
    expect(normalizeSearchText('Ỷ Lại')).toBe('y lai');
  });
});

describe('escapeLikePattern', () => {
  it('khong de ky tu dac biet thanh ky tu dai dien', () => {
    expect(escapeLikePattern('50%_a\\b')).toBe('50\\%\\_a\\\\b');
  });
});
