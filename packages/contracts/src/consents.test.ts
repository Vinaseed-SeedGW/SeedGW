import { describe, expect, it } from 'vitest';
import { LOCATION_CONSENT_KIND, renderConsentText, shortConsentCode } from './consents';

describe('renderConsentText', () => {
  it('có toàn văn cho cả bản cũ 17/11 và bản hiện tại, bản cũ giữ đúng tên app lúc đó', () => {
    const old = renderConsentText(LOCATION_CONSENT_KIND, '2026-11-17');
    const current = renderConsentText(LOCATION_CONSENT_KIND, '2026-11-19');
    expect(old).toContain('dùng DMS Vinaseed trong công việc');
    expect(old).toContain('Trang web DMS không lấy vị trí');
    expect(current).toContain('dùng SeedGW trong công việc');
    expect(renderConsentText(LOCATION_CONSENT_KIND, '2000-01-01')).toBeNull();
  });
  it('mã ngắn là 16 ký tự đầu, chia nhóm 4', () => {
    expect(shortConsentCode('a7200f964d67c3bd' + '0'.repeat(48))).toBe('A720-0F96-4D67-C3BD');
  });
});
