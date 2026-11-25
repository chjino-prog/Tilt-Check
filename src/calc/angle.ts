/**
 * 각도 계산 (순수 함수, 화면과 무관)
 * 모든 입력 · 출력은 도(°), 안에서만 라디안을 쓴다.
 *
 * 용어 (작업지시서 2장)
 *  T.A  횡단각 (Transversal Angle) : FRAME 방향 라인이 수평과 이루는 각 (= 폰이 재는 실제 경사)
 *  F.A  FRAME각 (Frame Angle)      : FRAME 면이 연직에서 기운 각 (LONGL. 방향 라인 값)
 *  δ    지주캡 WEB 이 FRAME 기준으로 돌아간 각 — 이 파일의 식에서는 '캡 상판(수평면)' 에서의 각
 *  s    회전 방향 : 선수 = +1, 선미 = −1
 *
 * 1.6.0 (2026-11-24 현장 분석) : 도면에서 오는 값은 식에 넣기 전에 바꾼다 (6 · 7번)
 *  - 도면 캡취부각도의 δ 는 외판 면 위의 각도 → 캡 자리 외판 기울기로 상판 각도로 바꾼다
 *  - 도면 T.A 는 단면도에서 본 회전각 → F.A 로 누운 만큼 실제 경사로 바꾼다
 */

export type Dir = 1 | -1;
export const BOW: Dir = 1; // 선수
export const STERN: Dir = -1; // 선미

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const sin = (deg: number) => Math.sin(deg * D2R);
const cos = (deg: number) => Math.cos(deg * D2R);

/** |x| > 1 이면 NaN (기하적으로 불가능한 입력) */
function asinDeg(x: number): number {
  if (x > 1 && x < 1 + 1e-12) x = 1;
  if (x < -1 && x > -1 - 1e-12) x = -1;
  return Math.asin(x) * R2D;
}

/** −180 ~ 180 으로 정규화 */
export function normDeg(d: number): number {
  let r = ((d + 180) % 360 + 360) % 360 - 180;
  if (r === -180) r = 180;
  return r;
}

/** 1) 일반 부재 라인 : FRAME 기준 ψ 만큼 돌아간 라인의 정상 경사 */
export function thetaLine(TA: number, FA: number, psi: number, s: Dir): number {
  return asinDeg(sin(TA) * cos(psi) + s * sin(FA) * sin(psi));
}

/** 2) 지주캡 정상값 A : ① WEB 상단, WEB 방향 */
export function thetaA(TA: number, FA: number, delta: number, s: Dir): number {
  return asinDeg(sin(TA) * cos(delta) + s * sin(FA) * sin(delta));
}

/** 2) 지주캡 정상값 B : ③ 상판, WEB 직각(LONGL.) 방향 */
export function thetaB(TA: number, FA: number, delta: number, s: Dir): number {
  return asinDeg(sin(FA) * cos(delta) - s * sin(TA) * sin(delta));
}

/** 3) 캡 1° 회전 시 각도기 A 변화 (°/°) */
export function dA(TA: number, FA: number, delta: number, s: Dir): number {
  const a = thetaA(TA, FA, delta, s);
  return Math.abs(s * sin(FA) * cos(delta) - sin(TA) * sin(delta)) / cos(a);
}

/** 3) 캡 1° 회전 시 각도기 B 변화 (°/°) */
export function dB(TA: number, FA: number, delta: number, s: Dir): number {
  const b = thetaB(TA, FA, delta, s);
  return Math.abs(sin(FA) * sin(delta) + s * sin(TA) * cos(delta)) / cos(b);
}

export type InverseResult =
  | { ok: true; deltaReal: number; rotErr: number }
  | { ok: false; reason: 'range' };

/** 4) B 실측값 → 실제 δ (정확해). 도면 δ 에 더 가까운 해를 고른다. */
export function inverseDelta(
  TA: number,
  FA: number,
  delta: number,
  s: Dir,
  thetaBMeas: number,
): InverseResult {
  const R = Math.sqrt(sin(FA) ** 2 + sin(TA) ** 2);
  const ratio = sin(thetaBMeas) / R;
  if (!(Math.abs(ratio) <= 1)) return { ok: false, reason: 'range' };
  const phi = Math.atan2(s * sin(TA), sin(FA)) * R2D;
  const c = Math.acos(ratio) * R2D;
  const d1 = normDeg(c - phi);
  const d2 = normDeg(-c - phi);
  const e1 = Math.abs(normDeg(d1 - delta));
  const e2 = Math.abs(normDeg(d2 - delta));
  const deltaReal = e1 <= e2 ? d1 : d2;
  return { ok: true, deltaReal, rotErr: normDeg(deltaReal - delta) };
}

export interface CapNormal {
  thetaA: number;
  thetaB: number;
  dA: number;
  dB: number;
}

export function capNormal(TA: number, FA: number, delta: number, s: Dir): CapNormal {
  return {
    thetaA: thetaA(TA, FA, delta, s),
    thetaB: thetaB(TA, FA, delta, s),
    dA: dA(TA, FA, delta, s),
    dB: dB(TA, FA, delta, s),
  };
}

export interface CapAnalysis extends CapNormal {
  errA: number; // A 실측 − 정상
  errB: number; // B 실측 − 정상
  inverseOk: boolean;
  deltaReal: number | null;
  rotErr: number | null;
  aPred: number | null;
  aResid: number | null;
}

/** 5) B 역산 + A 잔차까지 한 번에 */
export function analyzeCap(
  TA: number,
  FA: number,
  delta: number,
  s: Dir,
  measA: number,
  measB: number,
): CapAnalysis {
  const n = capNormal(TA, FA, delta, s);
  const inv = inverseDelta(TA, FA, delta, s, measB);
  let aPred: number | null = null;
  let aResid: number | null = null;
  if (inv.ok) {
    aPred = thetaA(TA, FA, inv.deltaReal, s);
    aResid = measA - aPred;
  }
  return {
    ...n,
    errA: measA - n.thetaA,
    errB: measB - n.thetaB,
    inverseOk: inv.ok,
    deltaReal: inv.ok ? inv.deltaReal : null,
    rotErr: inv.ok ? inv.rotErr : null,
    aPred,
    aResid,
  };
}

/** 블록 입력 검증 : 0 < F.A ≤ T.A < 90 */
export function blockAnglesLookRight(TA: number, FA: number): boolean {
  return FA > 0 && FA <= TA && TA < 90;
}

/**
 * 6) 외판 기울기 보정 — 도면 δ(외판 면 위) ↔ 캡 상판 δ(수평면)
 * 캡취부각도는 외판을 정면에서 본 그림이라, δ 는 외판에 그은 FR 선과 캡 중심선 사이 각이다.
 * 캡 WEB 은 수직판이라 외판이 서 있을수록 외판 위에서는 덜 돌아간 것처럼 보인다 (문을 열어도 경첩 선은 세로).
 * shell θ = 캡이 있는 FR 단면에서 외판 접선과 A/B 수평선 사이 각 (0 ≤ θ < 90). WEB 은 연직.
 *
 * 1.7.0 정확식 (1.6.0 근사식은 δ 가 커지면 틀어지고, δ ≥ 90° − θ 에서 계산이 안 됐다) :
 *   tan δ외판 = tan δ상판 · cos θ
 * θ < 90° 이면 모든 δ(0~90°)에서 계산된다. θ = 90° 는 cos 0 나눗셈이라 NaN.
 *
 * 외판 길이방향(선수미 방향) 기울기는 계산에서 뺀다 —
 * 길이방향 기울기 20°까지 영향 0.2° 이하, 30°에서 약 0.5° – 현장 판정에 지장 없음.
 */
export function capDeltaFromShell(delta: number, shell: number): number {
  const c = cos(shell);
  if (!(c > 1e-12)) return NaN;
  return Math.atan(Math.tan(delta * D2R) / c) * R2D;
}

export function shellDeltaFromCap(deltaCap: number, shell: number): number {
  return Math.atan(Math.tan(deltaCap * D2R) * cos(shell)) * R2D;
}

/**
 * 도면 δ 1° 가 캡 상판에서 몇 ° 인지 (dA · dB 를 도면 각도 1° 당으로 바꿀 때)
 *   k = dδc/dδ = (1/cosθ) · (1/cos²δ) ÷ (1 + tan²δc)
 */
export function shellScale(delta: number, shell: number): number {
  const c = cos(shell);
  if (!(c > 1e-12)) return NaN;
  const t = Math.tan(delta * D2R);
  const tc = t / c;
  return (1 / c) * (1 + t * t) / (1 + tc * tc);
}

/**
 * 7) 도면 T.A → 실제 경사
 * 도면 T.A 는 단면도(FRAME 면)에서 본 각이다. 그 FRAME 면이 F.A 만큼 누우면 같은 선이 덜 가팔라진다.
 *   sin(경사) = sin T.A · cos F.A
 * (2026-11-24 현장 : F.A 가 큰 블록 두 곳에서 이렇게 바꾸면 현물 T.A 와 0.4° 안, 안 바꾸면 0.7~1.2° 차이)
 * 현물 T.A 는 폰이 경사를 바로 재므로 바꾸지 않는다.
 */
export function taSlope(TA: number, FA: number): number {
  return asinDeg(sin(TA) * cos(FA));
}
