import { describe, expect, it } from 'vitest';
import { emptyAssetDraft, validateAssetDraft } from './assetDraft';

describe('validateAssetDraft', () => {
  it('reports every required general-info field on an empty draft', () => {
    const errors = validateAssetDraft(emptyAssetDraft());
    expect(Object.keys(errors).sort()).toEqual(
      ['deviceCode', 'deviceName', 'location', 'managingUnit', 'owner', 'specDetail'].sort(),
    );
  });

  it('adds allocation fields only when "allocated" is checked', () => {
    const base = {
      ...emptyAssetDraft(),
      managingUnit: 'A',
      location: 'B',
      owner: 'C',
      deviceCode: 'D',
      deviceName: 'E',
      specDetail: 'F',
    };
    expect(validateAssetDraft(base)).toEqual({});
    expect(validateAssetDraft({ ...base, allocated: true })).toEqual({
      employee: 'Bắt buộc',
      recordNo: 'Bắt buộc',
    });
  });
});
