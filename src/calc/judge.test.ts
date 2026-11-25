// 1.7.0 판정 체계 — A · B 현물 비교로 합격 · 불합격, 역산 회전각은 참고 (주의)
// 숫자는 시험용으로 지어낸 값 (회사 데이터 아님)
import { describe, expect, it } from 'vitest';
import { capJudge, cautionText, lowTaText, rotScale } from './judge';
import { capGeom, capResult, CALC_REV, recalcCapRecord } from './capcalc';
import { capNormalDir, signedB } from './sign';
import { buildReport } from './report';
import { CSV_HEADER, recordsToCsv } from './csv';
import type { MeasureRecord } from '../db/store';
import { DEFAULTS } from '../settings';

describe('판정 3단계', () => {
  it('NG : A 또는 B 편차가 허용오차를 넘음 — 역산 회전과 상관없이 NG 가 먼저', () => {
    expect(capJudge(3.2, 0.1, 0, 46, 3).verdict).toBe('NG');
    expect(capJudge(0.1, -3.2, 0, 46, 3).verdict).toBe('NG');
    const j = capJudge(0.1, -3.2, -12, 17, 3);
    expect(j.verdict).toBe('NG');
    expect(j.caution).toBeNull(); // NG 면 주의 사유는 띄우지 않는다
  });

  it('주의 : A · B 는 안인데 역산 회전이 허용오차를 넘거나 역산 불가', () => {
    expect(capJudge(0.2, -2.6, -8.2, 17.4, 3)).toMatchObject({ verdict: '주의', caution: 'rot', lowTa: true });
    expect(capJudge(0.2, 0.4, null, 46, 3)).toMatchObject({ verdict: '주의', caution: 'noinv', lowTa: false });
  });

  it('OK : 둘 다 아님 · 허용오차 경계값은 합격', () => {
    expect(capJudge(3, -3, 3, 46, 3)).toMatchObject({ verdict: 'OK', caution: null });
  });

  it('회전 환산 배율 1/sin(T.A) — 작업지시서 표', () => {
    expect(rotScale(46.7).toFixed(1)).toBe('1.4');
    expect(rotScale(34.4).toFixed(1)).toBe('1.8');
    expect(rotScale(17.4).toFixed(1)).toBe('3.3');
    // T.A 24° 가 배율 2.5 경계
    expect(rotScale(24)).toBeGreaterThan(2.45);
    expect(rotScale(24)).toBeLessThan(2.5);
  });

  it('주의 사유 글 : T.A 24° 미만이면 증폭 문구를 함께', () => {
    expect(cautionText(capJudge(0, 0, 4, 46, 3))).toBe('역산 회전각이 허용오차를 넘음 – 캡 회전 재확인');
    expect(cautionText(capJudge(0, 0, null, 46, 3))).toBe('역산 불가');
    expect(cautionText(capJudge(0, 0, 4, 17.4, 3))).toBe('역산 회전각이 허용오차를 넘음 – 캡 회전 재확인 · T.A 24° 미만 (회전 3.3배 증폭)');
    expect(lowTaText(rotScale(17.4))).toContain('약 3.3배로 커집니다(이 블록 N = 3.3)');
    expect(cautionText(capJudge(0, 0, 1, 17.4, 3))).toBe(''); // OK 면 사유 없음
  });
});

describe('T.A 17°대 블록에 정상 설치된 캡 8개 (현장 상황을 본뜬 예시값)', () => {
  // TS 캡(δ 0) 8개 : A 는 정상과 거의 같고, B 는 ±3° 안에서 흩어짐 (폰 · 수평계 측정 오차 수준)
  const TA = 17.4;
  const FA = 2.1;
  const bErr = [-1.66, -2.27, 0.4, 0.8, -0.35, -2.61, 0.22, -1.2];
  const aErr = [0.12, -0.3, 0.05, 0.21, -0.1, 0.33, -0.05, 0.0];
  const geo = { ta: TA, fa: FA, faDir: 1 as const, delta: 0, capDir: 1 as const, g: {} };
  const n = capNormalDir(TA, FA, 1, 0, 1);
  const runs = bErr.map((e, i) => capResult(geo, Math.abs(n.thetaA + aErr[i]), n.thetaB + e, DEFAULTS));

  it('A · B 편차가 모두 ±3° 안이라 NG 0건', () => {
    expect(runs.filter((r) => r.fields.verdict === 'NG')).toHaveLength(0);
  });

  it('역산 회전오차가 ±3° 를 넘는 캡만 주의, 사유에 T.A 24° 미만 문구', () => {
    const over = runs.filter((r) => Math.abs(r.analysis.rotErr!) > 3);
    expect(over.length).toBe(4);
    over.forEach((r) => {
      expect(r.fields.verdict).toBe('주의');
      expect(r.fields.caution).toContain('T.A 24° 미만');
    });
    expect(runs.filter((r) => r.fields.verdict === 'OK')).toHaveLength(4);
  });

  it('B 편차 2.61° 가 역산 회전 약 8~9° 로 부풀려진다 (배율 3.3)', () => {
    const r = runs[5];
    expect(r.analysis.errB).toBeCloseTo(-2.61, 6);
    expect(Math.abs(r.analysis.rotErr!)).toBeGreaterThan(7.5);
    expect(Math.abs(r.analysis.rotErr!)).toBeLessThan(9.5);
    expect(r.fields.rotScale!).toBeCloseTo(3.34, 2);
  });

  it('허용오차를 바꾸면 판정이 바로 다시 계산되고, 기록에는 그때 허용오차가 남는다', () => {
    const r = runs[5];
    const tight = capResult(geo, Math.abs(r.fields.measA!), r.fields.measB!, { ...DEFAULTS, capTol: 2.5 });
    expect(r.fields).toMatchObject({ verdict: '주의', tol: 3, calcRev: CALC_REV });
    expect(tight.fields).toMatchObject({ verdict: 'NG', tol: 2.5 });
  });

  it('CSV : 판정기준(A·B) · 역산회전(참고) · 배율 · 경고 · 허용오차 열, 계산방식 1.7.0', () => {
    for (const h of ['판정기준(A·B)', '역산회전(참고)', '회전 환산 배율', '경고(주의 사유)', '허용오차']) expect(CSV_HEADER).toContain(h);
    const rec = { id: 'r', createdAt: 0, blockId: 'b', ship: 'S', block: 'B', basis: 'ref', mode: 'cap', capId: 'c', capNo: 'TS1', memo: '', ...runs[5].fields } as MeasureRecord;
    const row = recordsToCsv([rec]).trim().split(/\r?\n/)[1].split(',');
    const at = (h: string) => row[CSV_HEADER.indexOf(h)];
    expect(at('판정')).toBe('주의');
    expect(at('판정기준(A·B)')).toBe('OK');
    expect(at('역산회전(참고)')).toMatch(/^-?\d+\.\d\d 초과$/);
    expect(at('회전 환산 배율')).toBe('3.3');
    expect(at('경고(주의 사유)')).toContain('T.A 24° 미만');
    expect(at('허용오차')).toBe('3.0');
    expect(at('계산방식')).toBe('1.7.0');
  });
});

describe('θ 미입력 캡 — 먼저 재고 사무실에서 θ 를 넣어 다시 계산', () => {
  // 지어낸 값 : 현물 T.A 46.66 · F.A 13.42 선수로 누움, 도면 δ 3° 선미, 턴오버 후, 실제 외판 73°
  const cap = { id: 'c', blockId: 'b', no: 'P1', delta: 3, dir: -1, createdAt: 0 } as import('../db/store').Cap;
  const block = { id: 'b', ship: 'S', block: 'B', ta: null, fa: null, capUp: true, memo: '', createdAt: 0, updatedAt: 0 } as import('../db/store').Block;
  const mB = signedB(6.46, -1, 1);

  it('θ 가 없으면 잰 값만 저장하고 판정은 θ 미입력', () => {
    const g = capGeom(cap, block);
    expect(g.shellMissing).toBe(true);
    const r = capResult({ ta: 46.66, fa: 13.42, faDir: 1, delta: 3, capDir: -1, g }, 48.1, mB, DEFAULTS);
    expect(r.pending).toBe(true);
    expect(r.fields).toMatchObject({ verdict: 'θ 미입력', measA: 48.1, measB: mB, calcRev: CALC_REV });
    expect(r.fields.normalA).toBeUndefined();
    expect(r.fields.rotErr).toBeUndefined();
  });

  it('나중에 θ 를 넣으면 같은 잰 값으로 판정이 나온다', () => {
    const g = capGeom(cap, block);
    const saved = { id: 'r', createdAt: 0, blockId: 'b', ship: 'S', block: 'B', basis: 'ref', mode: 'cap', capId: 'c', capNo: 'P1', memo: '', highB: -1,
      ...capResult({ ta: 46.66, fa: 13.42, faDir: 1, delta: 3, capDir: -1, g }, 48.1, mB, DEFAULTS).fields } as MeasureRecord;
    // θ 를 아직 안 넣었으면 그대로
    expect(recalcCapRecord(saved, cap, block, DEFAULTS)!.changed).toBe(false);
    // θ 73° 입력
    const re = recalcCapRecord(saved, { ...cap, shell: 73 }, block, DEFAULTS)!;
    expect(re.changed).toBe(true);
    expect(re.next).toMatchObject({ measA: 48.1, measB: mB, shell: 73, verdict: 'OK' });
    expect(re.next.rotErr!).toBeCloseTo(-0.28, 2);
    // 누운 외판은 0 을 넣는다 (보정 없이 판정)
    const flat = recalcCapRecord(saved, { ...cap, shell: 0 }, block, DEFAULTS)!;
    expect(flat.next.verdict).not.toBe('θ 미입력');
    expect(flat.next.shell).toBe(0);
  });

  it('CSV · 보고서에서 θ 미입력은 판정 칸이 비고 사유가 남는다', () => {
    const g = capGeom(cap, block);
    const rec = { id: 'r', createdAt: 0, blockId: 'b', ship: 'S', block: 'B', basis: 'ref', mode: 'cap', capId: 'c', capNo: 'P1', memo: '', highB: -1,
      ...capResult({ ta: 46.66, fa: 13.42, faDir: 1, delta: 3, capDir: -1, g }, 48.1, mB, DEFAULTS).fields } as MeasureRecord;
    const row = recordsToCsv([rec]).trim().split(/\r?\n/)[1].split(',');
    const at = (h: string) => row[CSV_HEADER.indexOf(h)];
    expect(at('판정')).toBe('θ 미입력');
    expect(at('정상값A')).toBe('');
    expect(at('경고(주의 사유)')).toContain('θ 미입력');
    const rep = buildReport({ ...block, refTa: 46.66, refFa: 13.42, refFaDir: 1 }, [cap], [rec], DEFAULTS);
    expect(rep.rows[0]).toMatchObject({ verdict: 'θ 미입력', rotText: 'θ 미입력', dirWarn: false });
    expect(rep.noShellCaps).toEqual(['P1']);
    expect(rep.undecided).toBe(1);
  });
});
