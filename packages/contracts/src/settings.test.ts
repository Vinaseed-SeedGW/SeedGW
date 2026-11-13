import { describe, expect, it } from 'vitest';
import {
  SETTING_GROUPS,
  formatSequenceCode,
  issuedCodeCount,
  resolveSystemSettings,
  saveCodeSequenceInput,
  saveSystemSettingsInput,
} from './settings';

const EXPECTED_UPDATED_AT = '2026-11-10T04:00:00.000Z';
const DEFAULTS = resolveSystemSettings({});

describe('SETTING_GROUPS', () => {
  it('moi gia tri mac dinh nam trong khoang cho phep', () => {
    for (const group of SETTING_GROUPS) {
      for (const { key, min, max, defaultValue } of group.settings) {
        expect(defaultValue, key).toBeGreaterThanOrEqual(min);
        expect(defaultValue, key).toBeLessThanOrEqual(max);
      }
    }
  });

  it('bo gia tri mac dinh hop le theo hop dong', () => {
    const parsed = saveSystemSettingsInput.safeParse({
      ...DEFAULTS,
      expectedUpdatedAt: EXPECTED_UPDATED_AT,
    });
    expect(parsed.success).toBe(true);
  });
});

describe('resolveSystemSettings', () => {
  it('giu gia tri da luu', () => {
    expect(resolveSystemSettings({ checkInRadiusM: 500 }).checkInRadiusM).toBe(500);
  });

  it('dung mac dinh khi gia tri ngoai khoang hoac sai kieu', () => {
    const resolved = resolveSystemSettings({
      checkInRadiusM: 1,
      dealerUnvisitedDaysLevel1: 'abc',
    });
    expect(resolved.checkInRadiusM).toBe(DEFAULTS.checkInRadiusM);
    expect(resolved.dealerUnvisitedDaysLevel1).toBe(14);
  });

  it('chiu duoc du lieu khong phai doi tuong', () => {
    expect(resolveSystemSettings(null)).toEqual(DEFAULTS);
  });
});

describe('saveSystemSettingsInput', () => {
  const valid = { ...DEFAULTS, expectedUpdatedAt: EXPECTED_UPDATED_AT };

  it('nhan so dang chuoi tu form', () => {
    const parsed = saveSystemSettingsInput.parse({ ...valid, checkInRadiusM: '300' });
    expect(parsed.checkInRadiusM).toBe(300);
  });

  it('tu choi o trong va so le', () => {
    expect(saveSystemSettingsInput.safeParse({ ...valid, checkInRadiusM: '' }).success).toBe(false);
    expect(saveSystemSettingsInput.safeParse({ ...valid, checkInRadiusM: 10.5 }).success).toBe(
      false,
    );
  });

  it('moc lau chua ghe tham co mac dinh theo cap dai ly', () => {
    expect(DEFAULTS.dealerUnvisitedDaysLevel1).toBe(14);
    expect(DEFAULTS.dealerUnvisitedDaysLevel2).toBe(30);
    expect(DEFAULTS.dealerUnvisitedDaysLevel3).toBe(45);
  });
});

describe('saveCodeSequenceInput', () => {
  const valid = {
    expectedUpdatedAt: EXPECTED_UPDATED_AT,
    prefix: ' dl ',
    digits: 5,
    rangeStart: 1,
    rangeEnd: 99999,
  };

  it('chuan hoa tien to ve chu hoa', () => {
    expect(saveCodeSequenceInput.parse(valid).prefix).toBe('DL');
  });

  it('tu choi so cuoi nho hon so dau', () => {
    const result = saveCodeSequenceInput.safeParse({ ...valid, rangeStart: 10, rangeEnd: 9 });
    expect(result.success).toBe(false);
  });

  it('tu choi so cuoi khong vua so chu so', () => {
    const result = saveCodeSequenceInput.safeParse({ ...valid, rangeEnd: 100000 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['rangeEnd']);
  });
});

describe('ma theo day so', () => {
  it('them so 0 dang truoc', () => {
    expect(formatSequenceCode('DL', 5, 42)).toBe('DL00042');
  });

  it('dem so ma da cap', () => {
    expect(issuedCodeCount({ rangeStart: 1, nextValue: 1 })).toBe(0);
    expect(issuedCodeCount({ rangeStart: 1, nextValue: 8 })).toBe(7);
  });
});
