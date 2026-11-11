import { describe, expect, it } from 'vitest';
import {
  createAssignmentInput,
  createHolidayInput,
  datesInRange,
  entryOn,
  formatShiftHours,
  resolveAssignmentStatus,
  resolveWorkday,
  shiftForm,
  weekdayOf,
  workingMinutes,
  type ShiftForm,
  type ShiftRule,
  type WorkdayContext,
} from './shifts';

function rule(id: string, extra: Partial<ShiftRule> = {}): ShiftRule {
  return {
    id,
    code: id.toUpperCase(),
    name: `Ca ${id}`,
    startMinute: 8 * 60,
    endMinute: 17 * 60,
    breakStartMinute: 12 * 60,
    breakEndMinute: 13 * 60,
    lateGraceMinutes: 5,
    earlyGraceMinutes: 5,
    workUnits: 1,
    workWeekdays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    ...extra,
  };
}

const HANH_CHINH = rule('hc');
const CA_SANG = rule('sang', {
  endMinute: 12 * 60,
  breakStartMinute: null,
  breakEndMinute: null,
  workUnits: 0.5,
  workWeekdays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
});

function context(extra: Partial<WorkdayContext> = {}): WorkdayContext {
  return {
    unitLineage: ['kv-1', 'vung-1', 'cty'],
    userTimeline: [],
    unitTimelines: new Map([['cty', [{ shiftId: 'hc', effectiveFrom: '2026-01-01' }]]]),
    shifts: new Map([
      ['hc', HANH_CHINH],
      ['sang', CA_SANG],
    ]),
    holidays: new Map(),
    ...extra,
  };
}

const MONDAY = '2026-11-09';
const SATURDAY = '2026-11-14';

describe('ngay trong tuan', () => {
  it('tinh dung thu cua ngay', () => {
    expect(weekdayOf(MONDAY)).toBe('MON');
    expect(weekdayOf(SATURDAY)).toBe('SAT');
    expect(weekdayOf('2026-11-15')).toBe('SUN');
  });
});

describe('xac dinh ca cua nhan vien', () => {
  it('khong gan rieng thi lay don vi cap tren gan nhat', () => {
    const day = resolveWorkday(MONDAY, context());
    expect(day.shift?.id).toBe('hc');
    expect(day.source).toEqual({ kind: 'ORG_UNIT', orgUnitId: 'cty' });
    expect(day.dayType).toBe('WORKDAY');
  });

  it('don vi gan hon thang don vi xa hon', () => {
    const unitTimelines = new Map([
      ['cty', [{ shiftId: 'hc', effectiveFrom: '2026-01-01' }]],
      ['vung-1', [{ shiftId: 'sang', effectiveFrom: '2026-01-01' }]],
    ]);
    expect(resolveWorkday(MONDAY, context({ unitTimelines })).shift?.id).toBe('sang');
  });

  it('gan rieng cho nhan vien uu tien hon don vi', () => {
    const day = resolveWorkday(
      MONDAY,
      context({ userTimeline: [{ shiftId: 'sang', effectiveFrom: '2026-11-01' }] }),
    );
    expect(day.shift?.id).toBe('sang');
    expect(day.source).toEqual({ kind: 'USER' });
  });

  it('lan gan moi chi co hieu luc tu ngay ap dung', () => {
    const userTimeline = [{ shiftId: 'sang', effectiveFrom: '2026-11-10' }];
    expect(resolveWorkday(MONDAY, context({ userTimeline })).shift?.id).toBe('hc');
    expect(resolveWorkday('2026-11-10', context({ userTimeline })).shift?.id).toBe('sang');
  });

  it('bo gan rieng thi quay ve theo don vi', () => {
    const userTimeline = [
      { shiftId: 'sang', effectiveFrom: '2026-10-01' },
      { shiftId: null, effectiveFrom: '2026-11-01' },
    ];
    expect(resolveWorkday(MONDAY, context({ userTimeline })).source).toEqual({
      kind: 'ORG_UNIT',
      orgUnitId: 'cty',
    });
  });

  it('don vi chuyen ve theo cap tren thi bo qua don vi do', () => {
    const unitTimelines = new Map([
      ['cty', [{ shiftId: 'hc', effectiveFrom: '2026-01-01' }]],
      [
        'kv-1',
        [
          { shiftId: 'sang', effectiveFrom: '2026-01-01' },
          { shiftId: null, effectiveFrom: '2026-11-01' },
        ],
      ],
    ]);
    expect(resolveWorkday(MONDAY, context({ unitTimelines })).shift?.id).toBe('hc');
  });

  it('khong co ca nao thi bao chua gan ca', () => {
    const day = resolveWorkday(MONDAY, context({ unitTimelines: new Map() }));
    expect(day.dayType).toBe('NO_SHIFT');
    expect(day.shift).toBeNull();
  });
});

describe('loai ngay', () => {
  it('ngay ngoai lich lam cua ca la ngay nghi', () => {
    expect(resolveWorkday(SATURDAY, context()).dayType).toBe('DAY_OFF');
  });

  it('ngay le la ngay nghi du roi vao ngay lam', () => {
    const holidays = new Map([[MONDAY, { name: 'Lễ', kind: 'HOLIDAY' as const }]]);
    const day = resolveWorkday(MONDAY, context({ holidays }));
    expect(day.dayType).toBe('HOLIDAY');
    expect(day.holidayName).toBe('Lễ');
  });

  it('ngay lam bu la ngay lam du roi vao ngay nghi', () => {
    const holidays = new Map([[SATURDAY, { name: 'Làm bù', kind: 'MAKEUP_WORKDAY' as const }]]);
    expect(resolveWorkday(SATURDAY, context({ holidays })).dayType).toBe('WORKDAY');
  });
});

describe('thoi gian lam cua ca', () => {
  it('tru gio nghi', () => {
    expect(workingMinutes(HANH_CHINH)).toBe(8 * 60);
  });

  it('ca qua dem tinh qua nua dem', () => {
    const night = {
      startMinute: 22 * 60,
      endMinute: 6 * 60,
      breakStartMinute: null,
      breakEndMinute: null,
    };
    expect(workingMinutes(night)).toBe(8 * 60);
    expect(formatShiftHours(night)).toBe('22:00 đến 06:00 hôm sau');
  });
});

describe('form ca', () => {
  const valid: ShiftForm = {
    code: 'hc',
    name: 'Hành chính',
    startTime: '08:00',
    endTime: '17:00',
    breakStartTime: '12:00',
    breakEndTime: '13:00',
    lateGraceMinutes: 5,
    earlyGraceMinutes: 5,
    workUnits: 1,
    workWeekdays: ['MON'],
  };

  it('hop le va doi ma sang chu hoa', () => {
    expect(shiftForm.parse(valid).code).toBe('HC');
  });

  it('chan gio nghi nam ngoai ca', () => {
    const result = shiftForm.safeParse({
      ...valid,
      breakStartTime: '18:00',
      breakEndTime: '19:00',
    });
    expect(result.success).toBe(false);
  });

  it('nhan gio nghi cua ca qua dem', () => {
    const night = {
      ...valid,
      startTime: '22:00',
      endTime: '06:00',
      breakStartTime: '01:00',
      breakEndTime: '01:30',
    };
    expect(shiftForm.safeParse(night).success).toBe(true);
  });

  it('bat nhap du hai dau gio nghi', () => {
    expect(shiftForm.safeParse({ ...valid, breakEndTime: '' }).success).toBe(false);
    expect(shiftForm.safeParse({ ...valid, breakStartTime: '', breakEndTime: '' }).success).toBe(
      true,
    );
  });

  it('so cong la boi cua 0,25', () => {
    expect(shiftForm.safeParse({ ...valid, workUnits: 0.5 }).success).toBe(true);
    expect(shiftForm.safeParse({ ...valid, workUnits: 0.3 }).success).toBe(false);
  });

  it('gio sai dang bi chan', () => {
    expect(shiftForm.safeParse({ ...valid, startTime: '25:00' }).success).toBe(false);
    expect(shiftForm.safeParse({ ...valid, endTime: '08:00' }).success).toBe(false);
  });
});

describe('gan ca va lich nghi', () => {
  it('lan gan moi nhat da toi ngay la lan dang ap dung', () => {
    const timeline = [
      { shiftId: 'hc', effectiveFrom: '2026-01-01' },
      { shiftId: 'sang', effectiveFrom: '2026-06-01' },
      { shiftId: 'hc', effectiveFrom: '2027-01-01' },
    ];
    expect(entryOn(timeline, '2026-11-11')?.effectiveFrom).toBe('2026-06-01');
    expect(resolveAssignmentStatus('2026-01-01', '2026-06-01', '2026-11-11')).toBe('REPLACED');
    expect(resolveAssignmentStatus('2026-06-01', '2026-06-01', '2026-11-11')).toBe('ACTIVE');
    expect(resolveAssignmentStatus('2027-01-01', '2026-06-01', '2026-11-11')).toBe('UPCOMING');
  });

  it('bo gia tri cua loai doi tuong khong chon', () => {
    const parsed = createAssignmentInput.parse({
      target: 'ORG_UNIT',
      orgUnitId: '6f1c1b1e-4f5a-4c1e-9c1a-1b2c3d4e5f60',
      userId: '6f1c1b1e-4f5a-4c1e-9c1a-1b2c3d4e5f61',
      shiftId: 'THEO_CAP_TREN',
      effectiveFrom: '2026-11-11',
    });
    expect(parsed.userId).toBeNull();
  });

  it('them nghi le theo khoang ngay', () => {
    expect(datesInRange('2026-12-31', '2027-01-02')).toEqual([
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
    const tooLong = createHolidayInput.safeParse({
      startDate: '2026-01-01',
      endDate: '2026-03-01',
      name: 'Dài',
      kind: 'HOLIDAY',
    });
    expect(tooLong.success).toBe(false);
  });
});
