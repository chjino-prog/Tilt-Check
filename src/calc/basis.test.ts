import { describe, expect, it } from 'vitest';
import { effectiveAngles, hasDesign, hasRef, refFromMeasure } from './basis';

// 숫자는 시험용으로 지어낸 값 (회사 데이터 아님)
describe('계산 기준 고르기', () => {
  it('도면값만 있으면 도면값', () => {
    expect(effectiveAngles({ ta: 10, fa: 5 })).toEqual({ ta: 10, fa: 5, faDir: 1, faDirSet: false, basis: 'design' });
  });

  it('현물값만 있으면 고른 기준과 상관없이 현물값', () => {
    expect(effectiveAngles({ ta: null, fa: null, refTa: 9, refFa: 4, basis: 'design' })).toEqual({ ta: 9, fa: 4, faDir: 1, faDirSet: false, basis: 'ref' });
  });

  it('둘 다 있으면 고른 기준을 따른다 (안 골랐으면 도면값)', () => {
    const b = { ta: 10, fa: 5, refTa: 9, refFa: 4 };
    expect(effectiveAngles(b)?.basis).toBe('design');
    expect(effectiveAngles({ ...b, basis: 'ref' })).toEqual({ ta: 9, fa: 4, faDir: 1, faDirSet: false, basis: 'ref' });
    expect(effectiveAngles({ ...b, basis: 'design' })?.ta).toBe(10);
  });

  it('현물 기준을 골랐어도 현물값이 없으면 도면값', () => {
    expect(effectiveAngles({ ta: 10, fa: 5, basis: 'ref' })?.basis).toBe('design');
  });

  it('둘 다 없으면 null, 한쪽만 들어 있어도 없는 것으로 본다', () => {
    expect(effectiveAngles({ ta: null, fa: null })).toBeNull();
    expect(effectiveAngles({ ta: 10, fa: null })).toBeNull();
    expect(hasDesign({ ta: 10, fa: null })).toBe(false);
    expect(hasRef({ ta: null, fa: null, refTa: 9 })).toBe(false);
  });

  it('기준 부재 측정값은 크기만 쓴다 (폰을 거꾸로 대도 같은 값)', () => {
    expect(refFromMeasure(-9.5, 4.25)).toEqual({ refTa: 9.5, refFa: 4.25 });
  });

  it('LONGL. 라인 높은 쪽 → F.A 방향은 그 반대쪽', () => {
    expect(refFromMeasure(9.5, -4.25, 1)).toEqual({ refTa: 9.5, refFa: 4.25, refFaDir: -1 });
    expect(refFromMeasure(9.5, 4.25, -1)?.refFaDir).toBe(1);
  });

  it('F.A 방향 : 도면 방향, 현물은 현물 방향 > 도면 방향', () => {
    expect(effectiveAngles({ ta: 10, fa: 5, faDir: -1 })).toMatchObject({ faDir: -1, faDirSet: true });
    expect(effectiveAngles({ ta: 10, fa: 5, faDir: -1, refTa: 9, refFa: 4, basis: 'ref' })?.faDir).toBe(-1);
    expect(effectiveAngles({ ta: 10, fa: 5, faDir: -1, refTa: 9, refFa: 4, refFaDir: 1, basis: 'ref' })?.faDir).toBe(1);
  });
});
