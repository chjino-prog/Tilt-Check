import { describe, expect, it } from 'vitest';
import { thetaA, thetaB, type Dir } from './angle';
import { buildReport, reportFileName, spanText } from './report';
import { analyzeCapDir, calcDir, capDirOf, capNormalDir, highOfB } from './sign';
import type { Block, Cap, MeasureRecord } from '../db/store';
import { DEFAULTS } from '../settings';

// 숫자는 시험용으로 지어낸 값 (회사 데이터 아님)
const TA = 10;
const FA = 5;
const FA_DIR: Dir = -1;
const t0 = new Date(2026, 10, 22, 9, 12).getTime();

const block: Block = { id: 'b', ship: 'S1', block: 'X01', ta: TA, fa: FA, faDir: FA_DIR, refTa: 10.2, refFa: 4.9, refFaDir: FA_DIR, memo: '', createdAt: 0, updatedAt: 0 };
const cap = (id: string, no: string, delta: number, dir: Dir): Cap => ({ id, blockId: 'b', no, delta, dir, createdAt: 0 });

/** 캡이 err° 만큼 더 돌아갔을 때의 기록 */
function rec(c: Cap, err: number, at: number, extra: Partial<MeasureRecord> = {}): MeasureRecord {
  const s = calcDir(capDirOf(c.delta, c.dir), FA_DIR);
  const mB = thetaB(TA, FA, c.delta + err, s);
  const mA = thetaA(TA, FA, c.delta + err, s);
  const n = capNormalDir(TA, FA, FA_DIR, c.delta, c.dir);
  const a = analyzeCapDir(TA, FA, FA_DIR, c.delta, c.dir, mA, mB);
  return {
    id: c.id + at, createdAt: at, blockId: 'b', ship: 'S1', block: 'X01', ta: TA, fa: FA, faDir: FA_DIR, basis: 'design', mode: 'cap',
    capId: c.id, capNo: c.no, delta: c.delta, dir: c.dir, normalA: n.thetaA, normalB: n.thetaB, measA: mA, measB: mB, highB: highOfB(mB, FA_DIR) ?? undefined,
    errA: a.errA, errB: a.errB, deltaReal: a.deltaReal, rotErr: a.rotErr, aResid: a.aResid, verdict: 'OK', memo: '', ...extra,
  };
}

const settings = { ...DEFAULTS, rotTol: 1 };

describe('지주캡 보고서 정리', () => {
  const c1 = cap('c1', 'TS1', 0, 1);
  const c2 = cap('c2', 'TS2', 0, 1);
  const c10 = cap('c10', 'TS10', 7, -1);
  const c3 = cap('c3', 'PSA1', 12, 1);

  it('캡마다 최근 기록 하나, 지금 허용값으로 판정, 캡 번호 순', () => {
    const recs = [rec(c1, 2, t0), rec(c1, 0.3, t0 + 60_000), rec(c2, -1.5, t0 + 120_000), rec(c10, 0.4, t0 + 180_000)];
    const r = buildReport(block, [c10, c2, c1, c3], recs, settings);
    expect(r.rows.map((x) => x.capNo)).toEqual(['PSA1', 'TS1', 'TS2', 'TS10']);
    expect(r.rows[0].measured).toBe(false); // PSA1 미측정
    expect(r.rows[1].rotErr).toBeCloseTo(0.3, 6); // TS1 은 두 번째 기록
    expect(r.rows[1].verdict).toBe('OK');
    expect(r.rows[2].verdict).toBe('NG');
    expect({ caps: r.caps, measured: r.measured, ok: r.ok, ng: r.ng }).toEqual({ caps: 4, measured: 3, ok: 2, ng: 1 });
    expect(r.worst?.capNo).toBe('TS2');
    expect(r.from).toBe(t0 + 60_000);
    expect(r.to).toBe(t0 + 180_000);
  });

  it('선수 쪽 기준 오차 : 선미로 돈 캡이 덜 돌면 선수 쪽 +', () => {
    const r = buildReport(block, [c10], [rec(c10, -0.5, t0)], settings);
    expect(r.rows[0].rotBow).toBeCloseTo(0.5, 6);
    expect(r.rows[0].rotText).toBe('선미 쪽으로 0.50° 덜 돌아감');
  });

  it('도면 · 현물 비교와 A 일치 확인', () => {
    const r = buildReport(block, [c1], [rec(c1, 0.2, t0)], settings);
    expect(r.taDiff).toBeCloseTo(0.2, 9);
    expect(r.faDiff).toBeCloseTo(0.1, 9);
    expect(r.faDirSame).toBe(true);
    expect(r.aOk).toBe(true);
    expect(buildReport({ ...block, refFaDir: 1 }, [c1], [], settings).faDirSame).toBe(false);
    expect(buildReport({ ...block, refTa: undefined, refFa: undefined }, [c1], [], settings).taDiff).toBeNull();
  });

  it('허용값이 없으면 기준미정, 1.2.0 전 기록은 빼고 센다', () => {
    const legacy = { ...rec(c2, 0.1, t0), faDir: undefined, highB: undefined };
    const r = buildReport(block, [c1, c2], [rec(c1, 0.2, t0), legacy], DEFAULTS);
    expect(r.rows[0].verdict).toBe('기준미정');
    expect(r.rows[1].measured).toBe(false);
    expect(r.skippedLegacy).toBe(1);
    expect(r.undecided).toBe(1);
  });

  it('캡 방향이 반대로 들어간 것 같으면 판정 보류', () => {
    // 캡 방향을 반대로 넣고 잰 값 : 실제 캡은 선수로 12° 인데 기록은 선미
    const real = rec(c3, 0, t0);
    const wrong = { ...real, dir: -1 as Dir };
    const r = buildReport(block, [{ ...c3, dir: -1 }], [wrong], settings);
    expect(r.rows[0].dirWarn).toBe(true);
    expect(r.rows[0].verdict).toBe('판정불가');
    expect(r.dirWarnCaps).toEqual(['PSA1']);
    expect(r.aOk).toBe(false);
  });

  it('날짜 표기와 파일 이름', () => {
    expect(spanText(t0, t0 + 53 * 60_000)).toEqual({ day: '26.11.22', time: '09:12 ~ 10:05' });
    expect(spanText(t0, t0 + 86_400_000).day).toBe('26.11.22 ~ 26.11.23');
    const r = buildReport({ ...block, block: 'X/01' }, [], [], settings);
    expect(reportFileName(r, t0)).toBe('TILTCHECK_S1_X_01_지주캡보고서_261122');
  });
});
