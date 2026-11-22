// 작업지시서 3장 기준값 — 모두 ±0.01° 이내 (표의 반올림 자리 기준)
import { describe, expect, it } from 'vitest';
import { analyzeCap, dA, dB, inverseDelta, normDeg, thetaA, thetaB, thetaLine, type Dir } from './angle';
import { analyzeCapDir, bDevText, calcDir, capNormalDir, dirSuspect, faHighSide, flipSuspect, highFromPhone, highOfB, highSensitive, longlDev, rotText, rotToBow, signedA, signedB } from './sign';
import { fmt, fmtSigned, isLegacyCap, sameSignWarning } from './judge';
import { recordsToCsv } from './csv';
import type { MeasureRecord } from '../db/store';

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

// ── 실물 모형 시험 (2026-11-22) — 블록 판을 T.A · F.A 대로 기울이고 캡을 δ + 실제오차만큼 돌린 3차원 모형으로
//    정답 A · B 를 만든 뒤, 현장처럼 '숫자 + 높은 쪽' 으로 넣어 회전오차를 되찾는지 본다.
const D2R = Math.PI / 180;
const sd = (x: number) => Math.sin(x * D2R);
const cd = (x: number) => Math.cos(x * D2R);
const asd = (x: number) => Math.asin(Math.max(-1, Math.min(1, x))) / D2R;
/** conv −1 : '돌아간 방향' = WEB 낮은 쪽 끝이 가는 쪽 (앱 약속) */
function truth(TA: number, FA: number, faDir: Dir, d: number, capDir: Dir) {
  const zL = -faDir * sd(FA); // F.A 방향 쪽 끝이 낮다
  const EL = [Math.sqrt(1 - zL * zL), 0, zL];
  const zT = sd(TA);
  const a = (-EL[2] * zT) / EL[0];
  const ET = [a, Math.sqrt(1 - a * a - zT * zT), zT];
  const k = -capDir;
  return { A: asd(cd(d) * ET[2] + k * sd(d) * EL[2]), Bbow: asd(-k * sd(d) * ET[2] + cd(d) * EL[2]) };
}
function fieldRun(TA: number, FA: number, faDir: Dir, delta: number, capDir: Dir, Bbow: number, A: number) {
  const high = Math.abs(Bbow) < 0.005 ? undefined : ((Bbow > 0 ? 1 : -1) as Dir);
  const n = capNormalDir(TA, FA, faDir, delta, capDir);
  const mB = high ? signedB(Math.abs(Bbow), high, faDir) : 0;
  return analyzeCapDir(TA, FA, faDir, delta, capDir, signedA(Math.abs(A), n.thetaA), mB);
}

describe('실물 모형 : 모든 방향 조합에서 회전오차를 되찾는다', () => {
  it('F.A 선수/선미 × 캡 선수/선미 × δ × 실제 회전오차', () => {
    let bad = 0;
    for (const TA of [20, 34.41, 46.25, 60])
      for (const FA of [0, 0.5, 3.23, 8.84])
        for (const faDir of [1, -1] as Dir[])
          for (const capDir of [1, -1] as Dir[])
            for (const delta of [0, 3, 7, 20, 35])
              for (const rot of [-5, -2, -0.5, 0, 0.5, 2, 5]) {
                const t = truth(TA, FA, faDir, delta + rot * (delta === 0 ? capDir : 1), capDir);
                const r = fieldRun(TA, FA, faDir, delta, capDir, t.Bbow, t.A);
                const tol = Math.abs(t.Bbow) < 0.005 ? 0.05 : 1e-6;
                if (r.rotErr == null || Math.abs(r.rotErr - rot) > tol || Math.abs(r.aResid!) > 1e-6) bad++;
              }
    expect(bad).toBe(0);
  });

  it('δ 0 캡은 돌아간 방향을 무엇으로 넣어도 같은 결과 (+ = 선수 쪽)', () => {
    const t = truth(34.41, 3.23, -1, 0.65, 1);
    const a = fieldRun(34.41, 3.23, -1, 0, 1, t.Bbow, t.A);
    const b = fieldRun(34.41, 3.23, -1, 0, -1, t.Bbow, t.A);
    expect(a.rotErr!).toBeCloseTo(0.65, 6);
    expect(b.rotErr!).toBeCloseTo(0.65, 6);
    expect(rotText(a.rotErr, 0, -1)).toBe('선수 쪽으로 0.65° 돌아감');
  });
});

describe('방향 실수 점검', () => {
  it('A 로 캡 · F.A 방향 점검 : 2026-11-21 현장값', () => {
    // 바른 방향(F.A 선미 · 캡 선미) → 의심 없음
    expect(dirSuspect(34.41, 3.23, -1, 7, -1, 34.6)).toBeNull();
    // F.A 방향을 안 정해 선수로 계산 → 정상 A 33.64 vs 실측 34.6 → 의심
    const s = dirSuspect(34.41, 3.23, 1, 7, -1, 34.6)!;
    expect(s).not.toBeNull();
    expect(s.aNow).toBeCloseTo(33.64, 2);
    expect(s.aFlip).toBeCloseTo(34.59, 2);
    // 캡 방향만 틀려도 의심
    expect(dirSuspect(34.41, 3.23, -1, 7, 1, 34.6)).not.toBeNull();
    // δ 0 캡 · 방향 차이가 작은 경우는 가를 수 없어 의심하지 않음
    expect(dirSuspect(34.41, 3.23, -1, 0, 1, 34.6)).toBeNull();
    expect(dirSuspect(34.41, 0.5, -1, 3, 1, 34.6)).toBeNull();
  });

  it('높은 쪽이 판정을 가르는 캡 : PSA(정상 B 0.74°) 예, TS(정상 B 3.23°) 아니오', () => {
    expect(highSensitive(34.41, 3.23, -1, 7, -1, null)).toBe(true);
    expect(highSensitive(34.41, 3.23, -1, 0, 1, null)).toBe(false);
  });

  it('PSA 실제 −4° 를 바르게 넣으면 NG 그대로, 반대쪽 결과(+1.39)는 비교용으로만', () => {
    const t = truth(34.41, 3.23, -1, 3, -1);
    const r = fieldRun(34.41, 3.23, -1, 7, -1, t.Bbow, t.A);
    expect(r.rotErr!).toBeCloseTo(-4, 6);
    expect(rotText(r.rotErr, 7, -1)).toBe('선미 쪽으로 4.00° 덜 돌아감');
    const flipped = analyzeCapDir(34.41, 3.23, -1, 7, -1, t.A, -signedB(Math.abs(t.Bbow), 1, -1));
    expect(flipped.rotErr!).toBeCloseTo(1.39, 1);
  });

  it('B 차이 · LONGL. 은 방향까지 글로 / 반대로 기운 라인은 큰 편차', () => {
    expect(bDevText(-0.86, -1)).toBe('선미 쪽이 0.86° 더 높아요');
    expect(longlDev(3.23, 1, -1, 3.23)).toBeCloseTo(0); // F.A 선미 → 선수가 높아야 정상
    expect(longlDev(3.0, -1, -1, 3.23)).toBeCloseTo(-6.23);
  });

  it('같은 방향 경고 : 블록 세팅이 1° 틀어지면 캡 방향이 섞여도 경고', () => {
    const caps: [string, number, Dir][] = [
      ['PSA1', 7, -1],
      ['PSA2', 7, 1],
      ['TS1', 0, 1],
    ];
    const recs = caps.map(([no, delta, dir], i) => {
      const t = truth(34.41, 4.23, -1, delta, dir); // 실물은 F.A 4.23
      const r = fieldRun(34.41, 3.23, -1, delta, dir, t.Bbow, t.A);
      return { id: no, mode: 'cap', capId: no, createdAt: i, delta, dir, faDir: -1, highB: 1, rotErr: r.rotErr } as unknown as MeasureRecord;
    });
    expect(new Set(recs.map((r) => Math.sign(r.rotErr!))).size).toBe(2); // 캡 기준 부호는 섞임
    recs.forEach((r) => expect(rotToBow(r.rotErr!, r.delta, r.dir)).toBeGreaterThan(0));
    expect(sameSignWarning(recs)).toMatchObject({ warn: true, sign: 1, count: 3 });
  });

  it('1.2.0 전 기록은 높은 쪽을 단정하지 않고 경고 계산에서 뺀다', () => {
    const old = { id: 'o', createdAt: 0, blockId: 'b', ship: 'S', block: 'B', ta: 34.41, fa: 3.23, mode: 'cap', capId: 'c', delta: 7, dir: -1, measB: 1.6, normalB: 7.17, rotErr: -7.84, verdict: 'NG', memo: '' } as MeasureRecord;
    expect(isLegacyCap(old)).toBe(true);
    const row = recordsToCsv([old]).trim().split(/\r?\n/)[1].split(',');
    expect(row.slice(-2)).toEqual(['', '']);
    expect(sameSignWarning([old, { ...old, id: 'p', capId: 'd' }]).warn).toBe(false);
  });

  it('빼기표는 한 가지(−)', () => {
    expect(fmt(-0.65, 2)).toBe('−0.65');
    expect(fmtSigned(-0.65, 2)).toBe('−0.65');
    expect(fmt(-0.001, 2)).toBe('0.00');
  });
});
