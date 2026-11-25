/**
 * 지주캡 계산 → 기록 칸 (결과 화면 저장 · 지난 기록 다시 계산이 같은 식을 쓰게 한 곳에)
 *
 * 1.6.0 계산 방식 (calcRev 2)
 *  - 도면 T.A 는 실제 경사로 바꿔 쓴다 (basis.ts · angle.ts 7번)
 *  - 도면 δ 는 캡 자리 외판 기울기로 캡 상판 각도로 바꿔 계산하고, 결과는 외판 위 각도로 돌려준다 (sign.ts 5번)
 *  - 턴오버 후(캡이 하늘을 봄)면 회전 부호를 뒤집는다 (sign.ts 4번)
 *
 * 1.7.0 계산 방식 (calcRev 3)
 *  - 외판 기울기 보정을 정확식 tan δ외판 = tan δ상판 · cos θ 로 (angle.ts 6번)
 *  - 판정은 A · B 현물 비교 (OK / 주의 / NG), 역산 회전각은 참고 (judge.ts capJudge)
 *  - 그 측정 때의 허용오차 · 회전 환산 배율 · 주의 사유를 기록에 남긴다
 */
import type { Dir } from './angle';
import { designSlope } from './basis';
import { capJudge, cautionText, isLegacyCap, type CapJudge } from './judge';
import { analyzeCapDir, capDirOf, capNormalDir, dirSuspect, signedA, type CapAnalysisDir, type CapGeom } from './sign';
import type { Block, Cap, MeasureRecord } from '../db/store';
import type { Settings } from '../settings';

/** 계산 방식 번호 — 2 = 1.6.0 (외판 기울기 · 턴오버 · 도면 T.A 경사), 3 = 1.7.0 (외판 정확식 · A·B 판정) */
export const CALC_REV = 3;

/** 계산 방식 번호 → CSV · 화면 글 */
export function calcRevName(rev: number | undefined): string {
  if (!rev) return '1.6.0 전';
  return rev >= 3 ? '1.7.0' : '1.6.0';
}

/** 캡의 계산 조건. δ 0 캡은 외판 기울기를 쓰지 않는다 */
export function capGeom(cap: Pick<Cap, 'delta' | 'shell'> | null | undefined, block: Pick<Block, 'capUp'> | null | undefined): CapGeom {
  const shell = cap && Math.abs(cap.delta) >= 1e-9 && cap.shell != null && cap.shell > 0 ? cap.shell : null;
  return { shell, up: !!block?.capUp };
}

export interface CapCalcIn {
  ta: number; // 계산에 쓰는 T.A (실제 경사)
  fa: number;
  faDir: Dir;
  delta: number; // 도면 δ
  capDir: Dir;
  g: CapGeom;
}

export interface CapResult {
  analysis: CapAnalysisDir;
  suspect: boolean; // A 가 반대 방향 정상값에 더 맞음 → 판정 보류
  judge: CapJudge; // A · B 판정 (보류여도 계산은 해 둔다)
  fields: Partial<MeasureRecord> & Pick<MeasureRecord, 'verdict'>;
}

/** 잰 A(크기) · 부호 붙인 B → 기록에 들어갈 계산 칸과 판정 */
export function capResult(c: CapCalcIn, measAbsA: number, measB: number, s: Settings): CapResult {
  const n = capNormalDir(c.ta, c.fa, c.faDir, c.delta, c.capDir, c.g);
  const measA = signedA(measAbsA, n.thetaA);
  const a = analyzeCapDir(c.ta, c.fa, c.faDir, c.delta, c.capDir, measA, measB, c.g);
  const suspect = dirSuspect(c.ta, c.fa, c.faDir, c.delta, c.capDir, measAbsA, c.g) != null;
  const judge = capJudge(a.errA, a.errB, a.rotErr, c.ta, s.capTol);
  return {
    analysis: a,
    suspect,
    judge,
    fields: {
      ta: c.ta,
      fa: c.fa,
      faDir: c.faDir,
      delta: c.delta,
      dir: capDirOf(c.delta, c.capDir),
      shell: c.g.shell ?? undefined,
      up: c.g.up || undefined,
      deltaCap: a.deltaCap,
      deltaRealCap: a.deltaRealCap,
      normalA: a.thetaA,
      normalB: a.thetaB,
      measA,
      measB,
      errA: a.errA,
      errB: a.errB,
      deltaReal: a.deltaReal,
      rotErr: a.rotErr,
      aResid: a.aResid,
      verdict: suspect ? '판정불가' : judge.verdict,
      tol: judge.tol,
      rotScale: judge.scale,
      caution: suspect ? undefined : cautionText(judge) || undefined,
      calcRev: CALC_REV,
    },
  };
}

const moved = (a: number | null | undefined, b: number | null | undefined) =>
  a == null || b == null ? (a == null) !== (b == null) : Math.abs(a - b) > 0.005;

/**
 * 저장된 지주캡 기록을 지금 캡(외판 기울기) · 블록(턴오버) 조건과 새 계산 방식으로 다시 계산한다.
 * 잰 값(A · B · 높은 쪽)은 그대로. 다시 계산할 수 없는 기록(1.2.0 전 · 값 없음)은 null.
 * 1.6.0 전 도면 기준 기록은 T.A 가 도면 값 그대로라 경사로 바꾼다.
 */
export function recalcCapRecord(r: MeasureRecord, cap: Cap | null | undefined, block: Block | null | undefined, s: Settings) {
  if (r.mode !== 'cap' || isLegacyCap(r) || r.measA == null || r.measB == null || r.delta == null || r.ta == null || r.fa == null) return null;
  const design = r.basis !== 'ref';
  const ta = design && !r.calcRev ? designSlope(r.ta, r.fa) : r.ta;
  const taDesign = design ? (r.calcRev ? r.taDesign : Math.abs(r.ta)) : undefined;
  const g = capGeom({ delta: r.delta, shell: cap?.shell }, block);
  const res = capResult({ ta, fa: r.fa, faDir: r.faDir ?? 1, delta: r.delta, capDir: r.dir ?? 1, g }, Math.abs(r.measA), r.measB, s);
  const next: MeasureRecord = { ...r, ...res.fields, taDesign, recalcAt: Date.now() };
  // 결과가 실제로 바뀔 때만 다시 계산을 권한다 (예전 방식이어도 값이 같으면 그대로 둔다)
  const changed =
    r.verdict !== next.verdict ||
    moved(r.rotErr, next.rotErr) ||
    moved(r.normalA, next.normalA) ||
    moved(r.normalB, next.normalB) ||
    (r.shell ?? null) !== (next.shell ?? null) ||
    !!r.up !== !!next.up;
  return { next, suspect: res.suspect, changed };
}
