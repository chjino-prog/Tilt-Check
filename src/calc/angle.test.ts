// 작업지시서 3장 기준값 — 모두 ±0.01° 이내 (표의 반올림 자리 기준)
import { describe, expect, it } from 'vitest';
import { analyzeCap, dA, dB, inverseDelta, normDeg, thetaA, thetaB, thetaLine, type Dir } from './angle';
import { analyzeCapDir, calcDir, capNormalDir, faHighSide, flipSuspect, highFromPhone, highOfB, signedA, signedB } from './sign';

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

// ── 방향 규칙 (sign.ts) — 도면 · 현장은 부호 대신 선수/선미

describe('방향 규칙', () => {
  it('거울 규칙 : 캡 방향과 F.A 방향이 같으면 s=+1', () => {
    expect(calcDir(1, 1)).toBe(1);
    expect(calcDir(-1, -1)).toBe(1);
    expect(calcDir(1, -1)).toBe(-1);
    expect(calcDir(-1, 1)).toBe(-1);
  });

  it('F.A 선미 · 캡 선미 = F.A 선수 · 캡 선수 와 같은 정상값', () => {
    const a = capNormalDir(46.25, 8.84, 1, 7, 1);
    const b = capNormalDir(46.25, 8.84, -1, 7, -1);
    expect(b.thetaA).toBeCloseTo(a.thetaA, 9);
    expect(b.thetaB).toBeCloseTo(a.thetaB, 9);
  });

  it('B 높은 쪽 : F.A 반대쪽이 높으면 +', () => {
    expect(faHighSide(-1)).toBe(1); // F.A 선미 → TS 는 선수가 높음
    expect(signedB(3.2, 1, -1)).toBeCloseTo(3.2);
    expect(signedB(1.6, -1, -1)).toBeCloseTo(-1.6);
    expect(signedB(-1.6, -1, -1)).toBeCloseTo(-1.6); // 숫자에 붙은 부호는 무시
    expect(signedB(2, -1, 1)).toBeCloseTo(2); // F.A 선수 → 선미가 높으면 +
    expect(highOfB(-1.6, -1)).toBe(-1);
    expect(highOfB(0, -1)).toBeNull();
  });

  it('폰 머리 방향 → 높은 쪽', () => {
    expect(highFromPhone(3.5, 1)).toBe(1);
    expect(highFromPhone(-3.5, 1)).toBe(-1);
    expect(highFromPhone(-3.5, -1)).toBe(1);
  });

  it('A 는 크기만', () => {
    expect(signedA(-34.6, 34.59)).toBeCloseTo(34.6);
  });

  // 2026-11-21 현장값 (도면 T.A 34.41 · F.A 선미 3.23, 디지털 수평계)
  it('F.A 선미 블록 : TS 는 선수 높음 = +F.A, PS 캡은 A 가 맞아떨어짐', () => {
    const ts = analyzeCapDir(34.41, 3.23, -1, 0, 1, 34.55, signedB(3.6, 1, -1));
    expect(ts.thetaB).toBeCloseTo(3.23, 2);
    expect(ts.rotErr!).toBeCloseTo(0.65, 1);
    const psa = analyzeCapDir(34.41, 3.23, -1, 7, -1, 34.6, signedB(1.6, -1, -1));
    expect(psa.thetaA).toBeCloseTo(34.59, 2); // 예전 식(s=−1)은 33.64 로 1° 어긋남
    expect(psa.thetaB).toBeCloseTo(-0.74, 2); // 선미 쪽이 0.74° 높은 게 정상
    expect(psa.rotErr!).toBeCloseTo(1.51, 1);
  });

  it('TS 캡에서 높은 쪽을 반대로 고르면 의심 표시', () => {
    const wrong = analyzeCapDir(34.41, 3.23, -1, 0, 1, 34.55, signedB(3.2, -1, -1));
    const right = analyzeCapDir(34.41, 3.23, -1, 0, 1, 34.55, signedB(3.2, 1, -1));
    expect(flipSuspect(wrong, right, 2)).not.toBeNull();
    expect(flipSuspect(right, wrong, 2)).toBeNull();
  });
});
