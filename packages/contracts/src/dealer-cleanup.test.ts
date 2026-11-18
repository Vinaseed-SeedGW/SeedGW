import { describe, expect, it } from 'vitest';
import {
  classifyPhoneRaw,
  fillFromMerged,
  fixDealerPhoneInput,
  mergeBlockReason,
  mergeDealersInput,
} from './dealer-cleanup';

const ID = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

describe('phone cleanup', () => {
  it('classifies broken phone numbers', () => {
    expect(classifyPhoneRaw('0')).toBe('JUNK');
    expect(classifyPhoneRaw(' ')).toBe('JUNK');
    expect(classifyPhoneRaw('055986184')).toBe('SHORT');
    expect(classifyPhoneRaw('09863234554')).toBe('LONG');
    expect(classifyPhoneRaw('abc 1234 567 890')).toBe('OTHER');
  });

  it('accepts only valid 10 digit numbers when fixing', () => {
    expect(fixDealerPhoneInput.parse({ id: ID, phone: '098 632 3455' }).phone).toBe('0986323455');
    expect(fixDealerPhoneInput.safeParse({ id: ID, phone: '09863234554' }).success).toBe(false);
  });
});

describe('merge rules', () => {
  it('blocks merging two dealers that both have a FAST code', () => {
    expect(mergeBlockReason({ id: ID, code: 'KH1' }, [{ id: OTHER, code: 'KH2' }])).toMatch(/FAST/);
  });

  it('requires keeping the dealer that has the FAST code', () => {
    expect(mergeBlockReason({ id: ID, code: null }, [{ id: OTHER, code: 'KH2' }])).toMatch(
      /bản giữ lại/,
    );
    expect(mergeBlockReason({ id: OTHER, code: 'KH2' }, [{ id: ID, code: null }])).toBeNull();
    expect(mergeBlockReason({ id: ID, code: null }, [{ id: OTHER, code: null }])).toBeNull();
  });

  it('rejects merging a dealer into itself', () => {
    expect(mergeDealersInput.safeParse({ keptId: ID, mergedIds: [ID] }).success).toBe(false);
  });

  it('fills only empty fields and takes coordinates as a pair', () => {
    const kept = {
      phone: '0912000000',
      ownerName: null,
      ownerPhone: null,
      taxCode: null,
      provinceName: 'Thành phố Hà Nội',
      lat: null,
      lng: null,
    };
    const fill = fillFromMerged(kept, [
      { ...kept, phone: '0988000000', ownerName: 'Bác Dung', lat: 21.01, lng: 105.8 },
      { ...kept, taxCode: '0101234567' },
    ]);
    expect(fill).toEqual({ ownerName: 'Bác Dung', taxCode: '0101234567', lat: 21.01, lng: 105.8 });
  });
});
