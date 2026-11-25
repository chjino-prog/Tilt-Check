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
 *
 * 4) 턴오버 : 도면의 '돌아간 방향' 은 캡 WEB 의 외판 쪽(바깥) 끝이 가는 쪽이다.
 *    캡이 바닥을 보는 보통 자세에서는 그 끝이 낮은 끝이라 1) 규칙 그대로다.
 *    블록을 턴오버해 캡이 하늘을 보면 그 끝이 높은 끝이 되므로 s 를 뒤집는다 (선수 · 선미는 그대로).
 *    (2026-11-24 현장 : 턴오버 후 잰 PSA 캡 3개가 뒤집지 않으면 '방향 반대' 로 보류, 뒤집으면 맞음)
 *
 * 5) 외판 기울기 (angle.ts 6번) : 도면 δ 는 외판 면 위 각도라, 계산식에는 캡 상판 각도로 바꿔 넣고
 *    실제 δ · 회전오차 · dA · dB 는 다시 도면과 같은 외판 위 각도로 돌려준다. δ 0 캡은 바꾸지 않는다.
 */
import {
  analyzeCap,
  capDeltaFromShell,
  capNormal,
  normDeg,
  shellDeltaFromCap,
  shellScale,
  thetaA,
  type CapAnalysis,
  type CapNormal,
  type Dir,
} from './angle';
import { fmt } from './judge';

export const dirName = (d: Dir) => (d === 1 ? '선수' : '선미');

/** 캡 계산 조건 — 잴 때 블록 자세 · 캡 자리 외판 */
export interface CapGeom {
  /** 캡 자리 외판 기울기 θ (FR 단면에서 외판 접선과 A/B 수평선 사이, 0~90). 없으면 δ 그대로 */
  shell?: number | null;
  /** 턴오버 후 — 캡이 하늘을 보는 자세에서 잼 */
  up?: boolean;
}

/** 계산식에 넣는 회전 부호 s (턴오버 후면 뒤집는다) */
export function calcDir(capDir: Dir, faDir: Dir, up = false): Dir {
  return (capDir * faDir * (up ? -1 : 1)) as Dir;
}

/** 외판 보정을 쓰는가 — δ 가 있고 외판 기울기가 0 보다 클 때 */
export function usesShell(delta: number, g?: CapGeom): g is CapGeom & { shell: number } {
  return Math.abs(delta) >= 1e-9 && g?.shell != null && isFinite(g.shell) && g.shell > 0;
}

/** 계산식에 넣을 캡 상판 δ (외판 기울기가 없거나 δ 0 이면 그대로) */
export function capDelta(delta: number, g?: CapGeom): number {
  return usesShell(delta, g) ? capDeltaFromShell(delta, g.shell) : delta;
}

/**
 * δ = 0 캡은 돌아간 방향이 뜻이 없다 → 늘 선수(+1)로 계산해서
 * 회전오차 + 가 언제나 '선수 쪽으로 돌아감' 이 되게 한다.
 */
export function capDirOf(delta: number, capDir: Dir | undefined): Dir {
  return Math.abs(delta) < 1e-9 ? 1 : (capDir ?? 1);
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

export interface CapNormalDir extends CapNormal {
  deltaCap: number; // 계산에 쓴 캡 상판 δ
}

export interface CapAnalysisDir extends CapAnalysis {
  deltaCap: number; // 계산에 쓴 캡 상판 δ
  deltaRealCap: number | null; // B 로 역산한 실제 상판 δ
}

/** 방향 · 자세 · 외판 기울기를 반영한 정상값. dA · dB 는 도면 δ 1° 당 */
export function capNormalDir(ta: number, fa: number, faDir: Dir, delta: number, capDir: Dir, g?: CapGeom): CapNormalDir {
  const dc = capDelta(delta, g);
  const n = capNormal(ta, fa, dc, calcDir(capDirOf(delta, capDir), faDir, g?.up));
  const k = usesShell(delta, g) ? shellScale(delta, g.shell) : 1;
  return { ...n, dA: n.dA * k, dB: n.dB * k, deltaCap: dc };
}

/**
 * 방향 · 자세 · 외판 기울기를 반영한 역산 · 잔차. measB 는 signedB 로 부호를 붙인 값.
 * 실제 δ · 회전오차는 도면과 같은 외판 위 각도로 돌려준다 (판정도 이 값으로).
 */
export function analyzeCapDir(ta: number, fa: number, faDir: Dir, delta: number, capDir: Dir, measA: number, measB: number, g?: CapGeom): CapAnalysisDir {
  const dc = capDelta(delta, g);
  const a = analyzeCap(ta, fa, dc, calcDir(capDirOf(delta, capDir), faDir, g?.up), measA, measB);
  const out: CapAnalysisDir = { ...a, deltaCap: dc, deltaRealCap: a.deltaReal };
  if (usesShell(delta, g)) {
    const k = shellScale(delta, g.shell);
    out.dA = a.dA * k;
    out.dB = a.dB * k;
    if (a.deltaReal != null && Math.abs(a.deltaReal) < 90) {
      out.deltaReal = shellDeltaFromCap(a.deltaReal, g.shell);
      out.rotErr = normDeg(out.deltaReal - delta);
    }
  }
  return out;
}

/**
 * 3) FRAME 누운 쪽 — 현장에서 눈으로 보이는 말.
 *    F.A 방향 = FRAME 이 누운 쪽 = LONGL. 라인의 낮은 끝 (FRAME 과 LONGL. 은 직각이라 늘 같다).
 *    → LONGL. 라인 높은 쪽 = 누운 쪽의 반대.
 */
export const longlHighOfLean = (lean: Dir): Dir => -lean as Dir;
export const leanOfLonglHigh = (high: Dir): Dir => -high as Dir;

/** F.A 방향을 글로 : '선미로 누움' */
export const leanText = (faDir: Dir) => `${dirName(faDir)}로 누움`;

/**
 * 판 기울기 재기 (폰 뒷면을 FRAME 웹에 붙임) → FRAME 누운 쪽.
 * face : 화면이 하늘 쪽이면 + (판 기울기 크기), facing : 사람이 바라보는 쪽 (선수 +1).
 * 폰 화면은 사람을 보므로, 화면이 하늘을 보면 웹 윗부분이 사람 반대쪽(바라보는 쪽)으로 누운 것이다.
 */
export function leanFromFace(face: number, facing: Dir): Dir | null {
  if (!isFinite(face) || Math.abs(face) < 0.005) return null;
  return face > 0 ? facing : (-facing as Dir);
}

/**
 * 높은 쪽이 판정을 가르는 캡인가 (1.7.0 : B 편차 기준) — 높은 쪽을 반대로 고르면 B 편차가 약 2 × 정상 B 가 된다.
 * 정상 B 가 허용오차보다 작으면 (PSA 캡처럼 거의 수평) 높은 쪽 착오가 허용오차 안에 숨어 걸러낼 수 없다.
 */
export function highSensitive(ta: number, fa: number, faDir: Dir, delta: number, capDir: Dir, tol: number, g?: CapGeom): boolean {
  const n = capNormalDir(ta, fa, faDir, delta, capDir, g);
  return Math.abs(n.thetaB) <= Math.abs(tol) + 1e-9;
}

export interface DirSuspect {
  aNow: number; // 지금 방향의 정상 A
  aFlip: number; // 방향이 반대일 때의 정상 A
}

/**
 * 캡 방향 · F.A 방향 · 턴오버 점검 — A 는 캡이 돌아도 거의 안 바뀌고(dA 작음) 방향에는 크게 바뀐다.
 * 실측 A 가 '반대 방향 정상 A' 에 뚜렷이 더 가까우면 방향이 반대로 들어간 것으로 본다.
 * (2026-11-21 현장 : 예전 식 정상 A 33.64 · 실측 34.6 · 바른 방향 34.59 — 사람이 찾아낸 착오를 앱이 잡게)
 */
export function dirSuspect(ta: number, fa: number, faDir: Dir, delta: number, capDir: Dir, measA: number, g?: CapGeom): DirSuspect | null {
  const s = calcDir(capDirOf(delta, capDir), faDir, g?.up);
  const dc = capDelta(delta, g);
  const aNow = thetaA(ta, fa, dc, s);
  const aFlip = thetaA(ta, fa, dc, (-s) as Dir);
  const m = Math.abs(measA);
  if (!isFinite(m) || Math.abs(aNow - aFlip) < 0.4) return null; // 방향에 따른 차이가 작으면 가를 수 없음
  return Math.abs(m - Math.abs(aFlip)) + 0.3 < Math.abs(m - Math.abs(aNow)) ? { aNow, aFlip } : null;
}

/** 회전오차를 글로 : '선미 쪽으로 4.00° 덜 돌아감' / δ0 캡은 '선수 쪽으로 0.65° 돌아감' */
export function rotText(rotErr: number | null | undefined, delta: number, capDir: Dir, d = 2): string {
  if (rotErr == null || !isFinite(rotErr)) return '';
  const a = Math.abs(rotErr);
  if (a < 0.005) return '도면과 같아요';
  const cd = capDirOf(delta, capDir);
  if (Math.abs(delta) < 1e-9) return `${dirName((rotErr > 0 ? cd : -cd) as Dir)} 쪽으로 ${fmt(a, d)}° 돌아감`;
  return `${dirName(cd)} 쪽으로 ${fmt(a, d)}° ${rotErr > 0 ? '더' : '덜'} 돌아감`;
}

/** 회전오차를 '선수 쪽 +' 하나의 기준으로 (캡마다 돌아간 방향이 달라도 비교할 수 있게) */
export function rotToBow(rotErr: number, delta: number | undefined, capDir: Dir | undefined): number {
  return rotErr * capDirOf(delta ?? 0, capDir);
}

/** B 차이를 글로 : '선미 쪽이 0.86° 더 높아요' (diff = 실측 − 정상, 계산용 부호) */
export function bDevText(diff: number | null | undefined, faDir: Dir, d = 2): string {
  if (diff == null || !isFinite(diff)) return '—';
  if (Math.abs(diff) < 0.5 * 10 ** -d) return '정상과 같아요';
  const h = (diff > 0 ? faHighSide(faDir) : -faHighSide(faDir)) as Dir;
  return `${dirName(h)} 쪽이 ${fmt(Math.abs(diff), d)}° 더 높아요`;
}

/** LONGL. 라인 : 크기 + 높은 쪽 → F.A 대비 차이 (정상은 F.A 반대쪽이 F.A 만큼 높음) */
export function longlDev(mag: number, high: Dir | null, faDir: Dir, fa: number): number {
  const signed = high == null ? 0 : signedB(mag, high, faDir);
  return signed - Math.abs(fa);
}

/**
 * 높은 쪽을 반대로 골랐을 가능성 (1.7.0 : B 편차 기준) — 지금은 B 편차가 허용오차를 넘는데
 * 반대로 넣으면 허용오차 안으로 확 줄어드는 경우. 돌려주는 값 = 반대로 넣었을 때의 B 편차 (의심 없으면 null)
 */
export function flipSuspect(cur: CapAnalysis, flipped: CapAnalysis, tol: number): number | null {
  const lim = Math.abs(tol);
  if (Math.abs(flipped.errB) > lim) return null;
  if (Math.abs(cur.errB) <= lim) return null;
  return Math.abs(flipped.errB) + 1 < Math.abs(cur.errB) ? flipped.errB : null;
}
