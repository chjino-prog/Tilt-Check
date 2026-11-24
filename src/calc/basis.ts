/**
 * 계산 기준 고르기 — 도면값(설계 T.A · F.A) 또는 현물값(기준 부재를 폰으로 잰 값)
 *
 * 현물값 : DECK 상면에서 CAMBER · SHEER 없는 FRAME 라인 → T.A,
 *          CENTER LINE 과 평행한 LONGL. 라인(GIRDER 류 강력부재) → F.A.
 * 같은 폰으로 기준과 지주캡을 재면 센서 치우침 · 블록 세팅 기울기가 양쪽에 같이 들어가 비교에서 지워진다.
 * 계산식(angle.ts)은 그대로 두고, 들어가는 T.A · F.A 만 바꾼다.
 *
 * 1.6.0 : 도면 T.A 는 단면도에서 본 회전각이라 계산에는 실제 경사(angle.ts 7번)를 쓴다.
 *         화면에는 도면 원래 값(taDesign)을 같이 보여준다. 현물 T.A 는 폰이 잰 경사 그대로.
 */

import { taSlope, type Dir } from './angle';

export type Basis = 'design' | 'ref';

export interface BlockAngles {
  ta: number | null; // 도면 T.A (모르면 null)
  fa: number | null; // 도면 F.A (크기)
  faDir?: Dir; // 도면 F.A 방향 (선수 +1 / 선미 −1, 예전 블록은 없음 = 선수)
  refTa?: number; // 현물 T.A
  refFa?: number; // 현물 F.A (크기)
  refFaDir?: Dir; // 현물에서 잰 F.A 방향
  basis?: Basis; // 사용자가 고른 기준 (없으면 도면값 우선)
}

export interface Effective {
  ta: number; // 계산에 쓰는 T.A = 실제 경사 (도면 기준이면 바꾼 값)
  taDesign?: number; // 도면 기준일 때 도면에 적힌 T.A 원래 값 (화면 표시용)
  fa: number; // 크기 (항상 0 이상)
  faDir: Dir; // F.A 방향
  faDirSet: boolean; // 방향을 사용자가 정했는지 (예전 블록은 false)
  basis: Basis;
}

/** 도면 T.A · F.A → 계산에 쓰는 경사 */
export const designSlope = (ta: number, fa: number) => taSlope(Math.abs(ta), Math.abs(fa));

/** T.A 글 : 도면 기준이면 '47.85°(경사 46.23°)' — 바꾼 값이 거의 같으면 하나만 */
export function taText(e: Pick<Effective, 'ta' | 'taDesign'>, fmtN: (v: number) => string): string {
  if (e.taDesign == null || Math.abs(e.taDesign - e.ta) < 0.005) return `${fmtN(e.ta)}°`;
  return `${fmtN(e.taDesign)}°(경사 ${fmtN(e.ta)}°)`;
}

const ok = (v: number | null | undefined): v is number => v != null && isFinite(v);

export function hasDesign(b: BlockAngles): boolean {
  return ok(b.ta) && ok(b.fa);
}

export function hasRef(b: BlockAngles): boolean {
  return ok(b.refTa) && ok(b.refFa);
}

/** 실제로 계산에 쓸 T.A · F.A. 고른 기준이 없으면 남은 쪽을 쓰고, 둘 다 없으면 null */
export function effectiveAngles(b: BlockAngles): Effective | null {
  const d = hasDesign(b);
  const r = hasRef(b);
  if (r && (b.basis === 'ref' || !d)) {
    const fd = b.refFaDir ?? b.faDir;
    return { ta: Math.abs(b.refTa!), fa: Math.abs(b.refFa!), faDir: fd ?? 1, faDirSet: fd != null, basis: 'ref' };
  }
  if (d)
    return {
      ta: designSlope(b.ta!, b.fa!),
      taDesign: Math.abs(b.ta!),
      fa: Math.abs(b.fa!),
      faDir: b.faDir ?? 1,
      faDirSet: b.faDir != null,
      basis: 'design',
    };
  return null;
}

/**
 * 기준 부재 측정값 → 현물 T.A · F.A (폰을 거꾸로 대도 같은 값이 되게 크기만 쓴다)
 * faHigh : LONGL. 라인에서 높은 쪽. F.A 방향은 그 반대쪽 (sign.ts 2번 규칙)
 */
export function refFromMeasure(measTa: number, measFa: number, faHigh?: Dir | null): { refTa: number; refFa: number; refFaDir?: Dir } {
  const r = { refTa: Math.abs(measTa), refFa: Math.abs(measFa) };
  return faHigh ? { ...r, refFaDir: -faHigh as Dir } : r;
}

export const basisName = (b: Basis) => (b === 'ref' ? '현물' : '도면');
