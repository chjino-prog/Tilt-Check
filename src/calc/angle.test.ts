// 작업지시서 3장 기준값 — 모두 ±0.01° 이내 (표의 반올림 자리 기준)
import { describe, expect, it } from 'vitest';
import { analyzeCap, capDeltaFromShell, dA, dB, inverseDelta, normDeg, shellDeltaFromCap, shellScale, taSlope, thetaA, thetaB, thetaLine, type Dir } from './angle';
import {
  analyzeCapDir,
  bDevText,
  calcDir,
  capNormalDir,
  dirSuspect,
  faHighSide,
  flipSuspect,
  highFromPhone,
  highOfB,
  highSensitive,
  longlDev,
  rotText,
  rotToBow,
  signedA,
  signedB,
  type CapGeom,
} from './sign';
import { capJudge, cautionText, fmt, fmtSigned, isLegacyCap, rotScale, sameSignWarning } from './judge';
import { CSV_HEADER, recordsToCsv } from './csv';
import { capGeom, capResult, recalcCapRecord } from './capcalc';
import type { Block, Cap, MeasureRecord } from '../db/store';
import { DEFAULTS } from '../settings';

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
    expect(highSensitive(34.41, 3.23, -1, 7, -1, 3)).toBe(true);
    expect(highSensitive(34.41, 3.23, -1, 0, 1, 3)).toBe(false);
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
    const at = (h: string) => row[CSV_HEADER.indexOf(h)];
    expect([at('실측B높은쪽'), at('정상B높은쪽')]).toEqual(['', '']);
    expect(at('계산방식')).toBe('1.6.0 전');
    expect(sameSignWarning([old, { ...old, id: 'p', capId: 'd' }]).warn).toBe(false);
  });

  it('빼기표는 한 가지(−)', () => {
    expect(fmt(-0.65, 2)).toBe('−0.65');
    expect(fmtSigned(-0.65, 2)).toBe('−0.65');
    expect(fmt(-0.001, 2)).toBe('0.00');
  });
});

// ── 1.6.0 (2026-11-24 현장 분석) : 외판 기울기 · 도면 T.A 경사 · 턴오버
// ── 1.7.0 : 외판 기울기 보정을 정확식 tan δ외판 = tan δ상판 · cos θ 로
describe('외판 기울기 보정 (도면 δ = 외판 면 위 각도)', () => {
  it('작업지시서 1.7.0 1번 표 : 정확식 δc 와 0.01° 안', () => {
    near(capDeltaFromShell(3, 73), 10.16);
    near(capDeltaFromShell(7, 55), 12.08);
    near(capDeltaFromShell(10, 73), 31.09);
    near(capDeltaFromShell(20, 60), 36.05);
    near(capDeltaFromShell(17, 73), 46.28); // 1.6.0 에서는 계산 불가
  });

  it('외판이 누워 있으면(0°) 그대로, 서 있을수록 상판 각도가 커진다', () => {
    expect(capDeltaFromShell(7, 0)).toBeCloseTo(7, 9);
    near(capDeltaFromShell(7, 43.5), 9.61);
    near(capDeltaFromShell(5, 54.5), 8.57);
    near(capDeltaFromShell(2, 71.5), 6.28);
  });

  it('3차원 모형으로 확인 : 연직 WEB 면과 외판 면이 만나는 선이 외판 위 δ', () => {
    for (const th of [0, 20, 43.5, 60, 73, 85])
      for (const dc of [1, 7, 20, 45, 70, 89]) {
        // FR 단면 (y 바깥 · z 위), x 선수. 외판 = x 축과 접선 t 를 담는 면, WEB = 상판에서 dc 돌아간 연직면
        const t = [0, cd(th), sd(th)];
        const n = [cd(dc), -sd(dc), 0]; // WEB 면의 법선
        // 외판 위 방향 a·x + b·t 가 WEB 면 안 : a·n0 + b·(t·n) = 0
        const a = -(t[0] * n[0] + t[1] * n[1] + t[2] * n[2]);
        const b = n[0];
        const onShell = Math.atan2(a, b) / D2R; // 외판 위에서 FR 선(t)과 이루는 각
        expect(capDeltaFromShell(onShell, th)).toBeCloseTo(dc, 9);
      }
  });

  it('거꾸로 바꾸면 제자리 · 부호 유지 · 모든 δ 에서 계산 (θ = 90° 만 불가)', () => {
    for (const th of [0, 20, 45, 60, 73, 85, 89.9])
      for (const d of [-40, -4, -1, 0.5, 2, 3, 4.9, 17, 30, 60, 89])
        expect(shellDeltaFromCap(capDeltaFromShell(d, th), th)).toBeCloseTo(d, 9);
    expect(capDeltaFromShell(-3, 73)).toBeCloseTo(-capDeltaFromShell(3, 73), 9);
    expect(capDeltaFromShell(17.5, 73)).not.toBeNaN();
    expect(capDeltaFromShell(3, 90)).toBeNaN();
  });

  it('k = dδc/dδ : 식 값이 수치 미분과 같고, δ 0 이면 1 ÷ cos θ', () => {
    near(shellScale(0, 60), 2, 1e-9);
    near(shellScale(0, 73), 1 / Math.cos((73 * Math.PI) / 180), 1e-9);
    expect(shellScale(5, 0)).toBeCloseTo(1, 9);
    for (const [d, th] of [[3, 73], [7, 55], [17, 73], [40, 30]]) {
      const h = 1e-4;
      const num = (capDeltaFromShell(d + h, th) - capDeltaFromShell(d - h, th)) / (2 * h);
      near(shellScale(d, th), num, 1e-6);
    }
  });

  it('δ 0 캡 · 외판 기울기 없음은 예전 계산과 같다', () => {
    expect(capGeom({ delta: 0, shell: 70 }, { capUp: true })).toEqual({ shell: null, up: true });
    expect(capGeom({ delta: 3, shell: 70 }, null)).toEqual({ shell: 70, up: false });
    const a = analyzeCapDir(34.41, 3.23, -1, 7, -1, 34.6, 0.5);
    const b = analyzeCapDir(34.41, 3.23, -1, 7, -1, 34.6, 0.5, { shell: null, up: false });
    expect(b.rotErr).toBe(a.rotErr);
    expect(b.deltaCap).toBe(7);
  });

  it('δ 17 · 외판 73 도 막히지 않고 정상값 · 1°당 변화가 나온다', () => {
    const n = capNormalDir(46.66, 13.42, 1, 17, -1, { shell: 73 });
    near(n.deltaCap, 46.28);
    expect(isFinite(n.thetaA) && isFinite(n.thetaB) && isFinite(n.dA) && isFinite(n.dB)).toBe(true);
  });
});

describe('도면 T.A → 실제 경사', () => {
  it('sin(경사) = sin T.A · cos F.A', () => {
    near(taSlope(47.846, 13.074), 46.23);
    near(taSlope(46.25, 8.84), 45.54);
    near(taSlope(34.41, 3.23), 34.35);
    expect(taSlope(30, 0)).toBeCloseTo(30, 9);
  });
});

/** 3차원 모형 (배 좌표 x 선수 · y 바깥 · z 위). up = 턴오버 후(캡이 하늘을 봄), dc = 캡 상판에서 돌아간 실제 각 */
function model(TA: number, FA: number, faDir: Dir, up: boolean, dc: number, capDir: Dir) {
  const sT = sd(TA);
  const sF = sd(FA);
  const c0 = Math.sqrt(1 - sT * sT - sF * sF);
  const u = up ? 1 : -1;
  const Z = [-faDir * sF, u * sT, -u * c0]; // 작업장 연직 : F.A 방향 쪽 끝이 낮고, 턴오버면 바깥 끝이 높다
  const w = [capDir * sd(dc), cd(dc), 0]; // WEB 바깥(외판 쪽) 끝 — 도면의 '돌아간 방향' 으로 간다
  const b = [cd(dc), -capDir * sd(dc), 0]; // 브라켓 방향 (선수 쪽 끝)
  const dot = (p: number[], q: number[]) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  return { A: asd(Math.abs(dot(w, Z))), Bbow: asd(dot(b, Z)), outerHigh: dot(w, Z) > 0 };
}

function fieldRun2(TA: number, FA: number, faDir: Dir, delta: number, capDir: Dir, g: CapGeom, Bbow: number, A: number) {
  const high = Math.abs(Bbow) < 0.005 ? undefined : ((Bbow > 0 ? 1 : -1) as Dir);
  const n = capNormalDir(TA, FA, faDir, delta, capDir, g);
  const mB = high ? signedB(Math.abs(Bbow), high, faDir) : 0;
  return analyzeCapDir(TA, FA, faDir, delta, capDir, signedA(Math.abs(A), n.thetaA), mB, g);
}

describe('턴오버 · 외판 기울기 실물 모형', () => {
  it('캡이 바닥을 보면 바깥 끝이 낮고, 하늘을 보면 높다', () => {
    expect(model(46.66, 13.42, 1, false, 10, -1).outerHigh).toBe(false);
    expect(model(46.66, 13.42, 1, true, 10, -1).outerHigh).toBe(true);
    expect(calcDir(-1, 1)).toBe(-1);
    expect(calcDir(-1, 1, true)).toBe(1);
  });

  it('모든 조합에서 도면 기준 회전오차를 되찾는다', () => {
    let bad = 0;
    let runs = 0;
    for (const TA of [20, 34.41, 46.66, 60])
      for (const FA of [0.5, 3.23, 8.84, 13.42])
        for (const faDir of [1, -1] as Dir[])
          for (const capDir of [1, -1] as Dir[])
            for (const up of [false, true])
              for (const shell of [0, 30, 55, 73])
                for (const delta of [2, 3, 7, 17])
                  for (const rot of [-1, -0.3, 0, 0.3, 1]) {
                    const g = { shell, up };
                    const dReal = shell > 0 ? capDeltaFromShell(delta + rot, shell) : delta + rot;
                    const t = model(TA, FA, faDir, up, dReal, capDir);
                    const r = fieldRun2(TA, FA, faDir, delta, capDir, g, t.Bbow, t.A);
                    const tol = Math.abs(t.Bbow) < 0.005 ? 0.05 : 1e-6;
                    runs++;
                    if (r.rotErr == null || Math.abs(r.rotErr - rot) > tol || Math.abs(r.aResid!) > 1e-6) bad++;
                  }
    expect(runs).toBeGreaterThan(1000);
    expect(bad).toBe(0);
  });

  it('턴오버 후 잰 PSA 캡 (2026-11-24 현장값) — 두 가지를 다 넣어야 맞는다', () => {
    // 현물 T.A 46.66 · F.A 13.42 선수로 누움, 도면 δ 3° 선미, 외판 73°, 실측 A 48.10 · B 6.46 선미 높음
    const mB = signedB(6.46, -1, 1);
    // 예전 계산 : 방향이 반대로 보이고 회전오차 −12°
    expect(dirSuspect(46.66, 13.42, 1, 3, -1, 48.1)).not.toBeNull();
    near(analyzeCapDir(46.66, 13.42, 1, 3, -1, 48.1, mB).rotErr!, -12.22);
    // 턴오버만 넣으면 방향은 맞지만 6° 더 돈 것처럼 보인다
    expect(dirSuspect(46.66, 13.42, 1, 3, -1, 48.1, { up: true })).toBeNull();
    near(analyzeCapDir(46.66, 13.42, 1, 3, -1, 48.1, mB, { up: true }).rotErr!, 6.22);
    // 외판 기울기까지 넣으면 도면 3° 에 0.3° 차이 (1.7.0 정확식 : 상판 10.16°, 1.6.0 근사식은 10.31°)
    const r = analyzeCapDir(46.66, 13.42, 1, 3, -1, 48.1, mB, { up: true, shell: 73 });
    near(r.deltaCap, 10.16);
    near(r.deltaReal!, 2.72);
    near(r.rotErr!, -0.28);
  });

  it('외판 BASE 캡도 외판 기울기를 넣으면 \'도면보다 더 돌아감\' 이 사라진다 (2026-11-24 현장값)', () => {
    // 도면 T.A 34.41 · F.A 3.23 선미, δ 7 선미, 외판 43.5°, 실측 A 35.09 · B 2.27 선미 높음
    const mB = signedB(2.27, -1, -1);
    near(analyzeCapDir(34.41, 3.23, -1, 7, -1, 35.09, mB).rotErr!, 2.69);
    near(analyzeCapDir(34.41, 3.23, -1, 7, -1, 35.09, mB, { shell: 43.5 }).rotErr!, 0.06); // 1.6.0 근사식은 0.01
  });

  it('지난 기록 다시 계산 : 잰 값은 그대로, 조건만 새로', () => {
    const settings = { ...DEFAULTS, capTol: 2 };
    const mB = signedB(6.46, -1, 1);
    const old = {
      id: 'r', createdAt: 0, blockId: 'b', ship: 'S', block: 'B', ta: 46.66, fa: 13.42, faDir: 1, basis: 'ref', mode: 'cap',
      capId: 'c', capNo: 'P1', delta: 3, dir: -1, measA: 48.1, measB: mB, highB: -1, rotErr: -12.22, verdict: 'NG', memo: '',
    } as MeasureRecord;
    const cap = { id: 'c', blockId: 'b', no: 'P1', delta: 3, dir: -1, shell: 73, createdAt: 0 } as Cap;
    const block = { id: 'b', ship: 'S', block: 'B', ta: null, fa: null, capUp: true, memo: '', createdAt: 0, updatedAt: 0 } as Block;
    const r = recalcCapRecord(old, cap, block, settings)!;
    expect(r.changed).toBe(true);
    expect(r.suspect).toBe(false);
    expect(r.next).toMatchObject({ measA: 48.1, measB: mB, highB: -1, shell: 73, up: true, verdict: 'OK', calcRev: 3, tol: 2 });
    near(r.next.rotErr!, -0.28);
    // 이미 새 방식으로 계산했고 조건이 같으면 다시 계산할 게 없다
    expect(recalcCapRecord(r.next, cap, block, settings)!.changed).toBe(false);
    // 1.6.0 전 도면 기준 기록은 T.A 를 경사로 바꾼다
    const d = recalcCapRecord({ ...old, basis: 'design', ta: 47.846, fa: 13.074 }, cap, block, settings)!;
    near(d.next.ta, 46.23);
    expect(d.next.taDesign).toBe(47.846);
  });
});
