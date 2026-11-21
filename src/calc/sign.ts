/**
 * 방향(선수 · 선미) 규칙 — 현장은 부호(+/−)를 쓰지 않는다.
 *
 * 도면은 "F.A 선미로 3.2°", "캡 선미로 7°" 처럼 방향으로 준다.
 * 현장 기록도 "1.60°, 선미 쪽이 높음" 처럼 숫자 + 높은 쪽으로 받는다.
 * 부호는 이 파일에서만 붙이고, 계산식(angle.ts)은 작업지시서 그대로 둔다.
 *
 * 1) 거울 규칙 : F.A 가 선미인 블록은 선수 · 선미를 통째로 뒤집어 본 F.A 선수 블록과 같다.
 *    → 계산에 넣는 회전 부호 s = (캡 방향) × (F.A 방향). 둘이 같은 쪽이면 +1.
 *    (2026-11-21 현장값 : F.A 선미 · 캡 선미 를 s=−1 로 넣어 A 가 1° 어긋났고, s=+1 이면 0.01° 로 맞음)
 *
 * 2) B 부호 : F.A 방향 쪽 끝이 낮다. 즉 TS캡(δ=0) · LONGL. 라인은 F.A 반대쪽이 높다.
 *    (2026-11-21 현장 확인 : F.A 선미 블록 → TS11 · TS12 · DECK LONGL. 모두 선수 쪽이 높음)
 *    → 그 쪽(F.A 반대쪽)이 높으면 B = +, F.A 쪽이 높으면 B = −.
 */
import { analyzeCap, capNormal, type CapAnalysis, type CapNormal, type Dir } from './angle';
import { fmt } from './judge';

export const dirName = (d: Dir) => (d === 1 ? '선수' : '선미');

/** 계산식에 넣는 회전 부호 s */
export function calcDir(capDir: Dir, faDir: Dir): Dir {
  return (capDir * faDir) as Dir;
}

/** TS캡(δ=0) · LONGL. 라인에서 높은 쪽 = F.A 반대쪽 */
export function faHighSide(faDir: Dir): Dir {
  return -faDir as Dir;
}

/** B 크기 + 높은 쪽 → 계산용 부호 붙은 B */
export function signedB(mag: number, high: Dir, faDir: Dir): number {
  const m = Math.abs(mag);
  return high === faHighSide(faDir) ? m : -m;
}

/** 부호 붙은 B → 높은 쪽 (거의 0 이면 null) */
export function highOfB(b: number, faDir: Dir): Dir | null {
  if (!isFinite(b) || Math.abs(b) < 0.005) return null;
  return b > 0 ? faHighSide(faDir) : (-faHighSide(faDir) as Dir);
}

/** B 값 표시 : "0.74° · 선미 높음" */
export function bText(b: number | null | undefined, faDir: Dir, d = 2): string {
  if (b == null || !isFinite(b)) return '—';
  const h = highOfB(b, faDir);
  return `${fmt(Math.abs(b), d)}° · ${h ? dirName(h) + ' 높음' : '수평'}`;
}

/** 폰 값(머리 쪽이 높으면 +) + 폰 머리가 향한 쪽 → 높은 쪽 (거의 0 이면 null) */
export function highFromPhone(reading: number, headDir: Dir): Dir | null {
  if (!isFinite(reading) || Math.abs(reading) < 0.005) return null;
  return reading > 0 ? headDir : (-headDir as Dir);
}

/** A 는 크기만 받는다 (폰 · 수평계를 어느 쪽으로 대도 같은 값) */
export function signedA(mag: number, normalA: number): number {
  return normalA < 0 ? -Math.abs(mag) : Math.abs(mag);
}

/** 방향을 반영한 정상값 */
export function capNormalDir(ta: number, fa: number, faDir: Dir, delta: number, capDir: Dir): CapNormal {
  return capNormal(ta, fa, delta, calcDir(capDir, faDir));
}

/** 방향을 반영한 역산 · 잔차. measB 는 signedB 로 부호를 붙인 값 */
export function analyzeCapDir(ta: number, fa: number, faDir: Dir, delta: number, capDir: Dir, measA: number, measB: number): CapAnalysis {
  return analyzeCap(ta, fa, delta, calcDir(capDir, faDir), measA, measB);
}

/**
 * 높은 쪽을 반대로 골랐을 가능성 — 반대로 넣으면 회전오차가 확 줄어드는 경우.
 * 돌려주는 값 = 반대로 넣었을 때의 회전오차 (의심 없으면 null)
 */
export function flipSuspect(cur: CapAnalysis, flipped: CapAnalysis, tol: number | null): number | null {
  if (flipped.rotErr == null) return null;
  const lim = Math.max(tol ?? 2, 1);
  if (Math.abs(flipped.rotErr) > lim) return null;
  if (cur.rotErr == null) return flipped.rotErr;
  if (Math.abs(cur.rotErr) <= lim) return null;
  return Math.abs(flipped.rotErr) + 1 < Math.abs(cur.rotErr) ? flipped.rotErr : null;
}
