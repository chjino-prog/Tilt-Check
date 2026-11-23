/**
 * 센서 → 각도
 * 1) 선 재기 (긴 축) : θ = asin(gy / |g|) — 폰 긴 축이 가리키는 선의 기울기.
 *    폰을 눕혀 대든 세워 대든(긴 축 기준으로 굴려도) 같은 값이 나온다.
 * 2) 판 기울기 재기 (화면 축) : face = asin(gz / |g|) — 폰 뒷면을 판에 붙였을 때
 *    화면이 하늘 쪽으로 기운 각. 연직에 가까운 판(FRAME 웹)이 연직에서 누운 각과 같고,
 *    폰을 판 위에서 어떻게 돌려 대도 같은 값이다.
 */
import { useEffect, useState } from 'preact/hooks';
import { getSettings } from '../settings';

export type SensorStatus = 'starting' | 'need-permission' | 'denied' | 'unsupported' | 'running';

export interface TiltState {
  status: SensorStatus;
  /** 보정 · 필터 적용된 각도 (°). 폰 윗단이 높으면 + */
  angle: number | null;
  /** 보정 전 각도 (영점 보정용, ▲▼ 뒤집기 전) */
  raw: number | null;
  stable: boolean;
  moving: boolean;
  /** 판 기울기 (°) : 화면이 하늘 쪽이면 +, 땅 쪽이면 − (뒷면 보정 적용) */
  face: number | null;
  /** 화면 축 보정 전 값 (중력 1 기준, 뒷면 보정용) */
  faceRaw: number | null;
  faceStable: boolean;
}

const G = 9.81;
const G_TOL = 0.5;
const ALPHA = 0.1; // EMA 저역통과
const WINDOW_MS = 1000; // 이동평균 · 안정 판정 구간
const STABLE_STD = 0.05; // 안정 판정 표준편차 (°)
const STABLE_RATIO = Math.sin((STABLE_STD * Math.PI) / 180); // 화면 축 안정 판정 (비율)
const NO_DATA_MS = 2500;
const R2D = 180 / Math.PI;

// 아이폰 사파리는 accelerationIncludingGravity 부호가 안드로이드와 반대
const IS_IOS =
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const PLATFORM_SIGN = IS_IOS ? -1 : 1;

type MotionCtor = typeof DeviceMotionEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

const clamp1 = (x: number) => Math.max(-1, Math.min(1, x));

/** 저역통과 + 1초 이동평균 + 안정 판정 */
class Smoother {
  private ema: number | null = null;
  private win: { t: number; v: number }[] = [];
  reset() {
    this.ema = null;
    this.win = [];
  }
  push(x: number, now: number, stableStd: number): { mean: number; stable: boolean } {
    this.ema = this.ema == null ? x : this.ema + ALPHA * (x - this.ema);
    this.win.push({ t: now, v: this.ema });
    while (this.win.length && now - this.win[0].t > WINDOW_MS) this.win.shift();
    const n = this.win.length;
    const mean = this.win.reduce((s, p) => s + p.v, 0) / n;
    const sd = Math.sqrt(this.win.reduce((s, p) => s + (p.v - mean) ** 2, 0) / n);
    const span = n > 1 ? now - this.win[0].t : 0;
    return { mean, stable: span >= WINDOW_MS * 0.8 && sd < stableStd };
  }
}

class TiltSensor {
  state: TiltState = { status: 'starting', angle: null, raw: null, stable: false, moving: false, face: null, faceRaw: null, faceStable: false };
  private listeners = new Set<(s: TiltState) => void>();
  private listening = false;
  private line = new Smoother();
  private faceS = new Smoother();
  private faceRawS = new Smoother();
  private gotData = false;
  private noDataTimer: number | undefined;
  private raf = 0;

  private set(patch: Partial<TiltState>) {
    this.state = { ...this.state, ...patch };
    if (!this.raf) {
      this.raf = requestAnimationFrame(() => {
        this.raf = 0;
        this.listeners.forEach((l) => l(this.state));
      });
    }
  }

  subscribe(l: (s: TiltState) => void) {
    this.listeners.add(l);
    l(this.state);
    if (!this.listening && this.state.status !== 'need-permission') this.start();
    return () => void this.listeners.delete(l);
  }

  start() {
    if (this.listening) return;
    const M = (globalThis as { DeviceMotionEvent?: MotionCtor }).DeviceMotionEvent;
    if (!M) return this.set({ status: 'unsupported' });
    if (typeof M.requestPermission === 'function' && this.state.status !== 'running' && !this.permitted) {
      return this.set({ status: 'need-permission' });
    }
    this.listen();
  }

  private permitted = false;

  /** 아이폰 : 버튼을 눌렀을 때만 권한을 물을 수 있다 */
  async requestPermission() {
    const M = (globalThis as { DeviceMotionEvent?: MotionCtor }).DeviceMotionEvent;
    if (!M?.requestPermission) return this.listen();
    try {
      const r = await M.requestPermission();
      if (r === 'granted') {
        this.permitted = true;
        this.listen();
      } else this.set({ status: 'denied' });
    } catch {
      this.set({ status: 'denied' });
    }
  }

  private listen() {
    if (this.listening) return;
    this.listening = true;
    this.set({ status: 'starting' });
    window.addEventListener('devicemotion', this.onMotion);
    this.noDataTimer = window.setTimeout(() => {
      if (!this.gotData) this.set({ status: 'unsupported' });
    }, NO_DATA_MS);
  }

  /** 흔들림 뒤 · 화면 전환 시 필터를 비운다 */
  reset() {
    this.line.reset();
    this.faceS.reset();
    this.faceRawS.reset();
    this.set({ stable: false, faceStable: false });
  }

  private onMotion = (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null || a.y == null || a.z == null) return;
    if (!this.gotData) {
      this.gotData = true;
      clearTimeout(this.noDataTimer);
    }
    const g = Math.hypot(a.x, a.y, a.z);
    if (Math.abs(g - G) > G_TOL) {
      // 흔들림 — 값 갱신을 멈추고 필터를 비운다
      this.line.reset();
      this.faceS.reset();
      this.faceRawS.reset();
      return this.set({ status: 'running', moving: true, stable: false, faceStable: false });
    }
    const now = performance.now();
    // 1) 긴 축
    const theta = Math.asin(clamp1((PLATFORM_SIGN * a.y) / g)) * R2D;
    const L = this.line.push(theta, now, STABLE_STD);
    // 2) 화면 축 : 치우침은 중력으로 나누기 전 값에서 빼야 한다
    //    (책상에 눕혀 놓으면 |g| 에 치우침이 같이 들어가 나눈 값에서는 안 보이기 때문)
    const { offset, flipSign, faceBias, faceSign } = getSettings();
    const zr = (PLATFORM_SIGN * a.z) / G; // 보정 전 (중력 1 기준)
    const zc = faceSign * (zr - (faceBias ?? 0));
    const ratio = zc / Math.hypot(a.x / G, a.y / G, zc);
    const F = this.faceS.push(ratio, now, STABLE_RATIO);
    const R = this.faceRawS.push(zr, now, STABLE_RATIO);

    const angle = (flipSign ? -1 : 1) * (L.mean - (offset ?? 0));
    const face = Math.asin(clamp1(F.mean)) * R2D;
    this.set({ status: 'running', raw: L.mean, angle, stable: L.stable, moving: false, face, faceRaw: R.mean, faceStable: F.stable && R.stable });
  };
}

export const tilt = new TiltSensor();

/** 화면에서 쓰는 훅. 화면을 열 때마다 필터를 비운다. */
export function useTilt(): TiltState {
  const [s, set] = useState(tilt.state);
  useEffect(() => {
    tilt.reset();
    return tilt.subscribe(set);
  }, []);
  return s;
}

/** 측정 중 화면 꺼짐 방지 */
export function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    let alive = true;
    const req = async () => {
      try {
        const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
        if (wl && alive && document.visibilityState === 'visible') lock = await wl.request('screen');
      } catch {
        /* 지원 안 하면 무시 */
      }
    };
    req();
    const onVis = () => document.visibilityState === 'visible' && req();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => {});
    };
  }, []);
}

export function vibrate(pattern: number | number[] = 40) {
  if (!getSettings().vibrate) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* 무시 */
  }
}
