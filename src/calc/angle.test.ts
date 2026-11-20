// 작업지시서 3장 기준값 — 모두 ±0.01° 이내 (표의 반올림 자리 기준)
import { describe, expect, it } from 'vitest';
import { analyzeCap, dA, dB, inverseDelta, normDeg, thetaA, thetaB, thetaLine, type Dir } from './angle';

const near = (actual: number, expected: number, tol = 0.01) => {
  // 표 값(소수 2자리)과의 차이가 0.01° 이하
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);
};

describe('지주캡 정상값 θA · θB', () => {
  const rows: [number, number, number, Dir, number, number][] = [
    [47.846, 13.074, 0, 1, 47.85, 13.07],
    [47.846, 13.074, 3, 1, 48.78, 10.78],
    [47.846, 13.074, 3, -1, 46.76, 15.35],
    [47.846, 13.074, 20, 1, 50.71, -2.35],
    [47.846, 13.074, 20, -1, 38.26, 27.78],
    [46.25, 8.84, 7, 1, 47.37, 3.7],
  ];
  it.each(rows)('T.A %f F.A %f δ %f s %i', (TA, FA, d, s, a, b) => {
    near(thetaA(TA, FA, d, s), a);
    near(thetaB(TA, FA, d, s), b);
  });

  it('1°당 변화 dA · dB', () => {
    near(dA(46.25, 8.84, 7, 1), 0.1);
    near(dB(46.25, 8.84, 7, 1), 0.74);
  });
});

describe('일반 부재 라인', () => {
  it('ψ=0 → T.A, ψ=90 → F.A', () => {
    near(thetaLine(47.846, 13.074, 0, 1), 47.846);
    near(thetaLine(47.846, 13.074, 90, 1), 13.074);
  });
  it('ψ=δ 이면 θA 와 같다', () => {
    near(thetaLine(46.25, 8.84, 7, 1), thetaA(46.25, 8.84, 7, 1), 1e-9);
  });
});

describe('B 역산 (T.A 46.25, F.A 8.84, δ 7, s +1)', () => {
  const rows: [number, number, number, number, number, number][] = [
    [0.6, 48.3, 11.2, 4.2, 47.6, 0.7],
    [1.7, 47.45, 9.71, 2.71, 47.56, -0.11],
    [0.15, 48.1, 11.81, 4.81, 47.61, 0.49],
    [2.75, 47.5, 8.29, 1.29, 47.47, 0.03],
  ];
  it.each(rows)('θB %f θA %f', (mB, mA, dReal, rot, aPred, aRes) => {
    const r = analyzeCap(46.25, 8.84, 7, 1, mA, mB);
    expect(r.inverseOk).toBe(true);
    near(r.deltaReal!, dReal);
    near(r.rotErr!, rot);
    near(r.aPred!, aPred);
    near(r.aResid!, aRes);
  });

  it('범위 초과는 실패로 알린다', () => {
    const r = inverseDelta(46.25, 8.84, 7, 1, 80);
    expect(r.ok).toBe(false);
  });
});

describe('정상값 → 역산 → δ 복원', () => {
  const cases: [number, number][] = [
    [47.846, 13.074],
    [46.25, 8.84],
  ];
  for (const [TA, FA] of cases) {
    for (const d of [0, 3, 7, 20]) {
      for (const s of [1, -1] as Dir[]) {
        it(`T.A ${TA} F.A ${FA} δ ${d} s ${s}`, () => {
          const b = thetaB(TA, FA, d, s);
          const r = inverseDelta(TA, FA, d, s, b);
          expect(r.ok).toBe(true);
          if (r.ok) {
            expect(Math.abs(r.deltaReal - d)).toBeLessThan(1e-6);
            expect(Math.abs(r.rotErr)).toBeLessThan(1e-6);
          }
        });
      }
    }
  }
});

describe('normDeg', () => {
  it('−180 ~ 180', () => {
    expect(normDeg(190)).toBeCloseTo(-170);
    expect(normDeg(-190)).toBeCloseTo(170);
    expect(normDeg(180)).toBe(180);
  });
});
