/**
 * 센서 → 경사각
 * 측정 축 = 폰 긴 축(장변, 기기 y축). θ = asin(gy / |g|)
 * → 폰을 눕혀 대든 세워 대든(긴 축 기준으로 굴려도) 같은 값이 나온다.
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
}

const G = 9.81;
const G_TOL = 0.5;
const ALPHA = 0.1; // EMA 저역통과
const WINDOW_MS = 1000; // 이동평균 · 안정 판정 구간
const STABLE_STD = 0.05; // 안정 판정 표준편차 (°)
const NO_DATA_MS = 2500;

// 아이폰 사파리는 accelerationIncludingGravity 부호가 안드로이드와 반대
const IS_IOS =
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const PLATFORM_SIGN = IS_IOS ? -1 : 1;

type MotionCtor = typeof DeviceMotionEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

class TiltSensor {
  state: TiltState = { status: 'starting', angle: null, raw: null, stable: false, moving: false };
  private listeners = new Set<(s: TiltState) => void>();
  private listening = false;
  private ema: number | null = null;
  private win: { t: number; v: number }[] = [];
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
    this.ema = null;
    this.win = [];
    this.set({ stable: false });
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
      this.ema = null;
      this.win = [];
      return this.set({ status: 'running', moving: true, stable: false });
    }
    const theta = (Math.asin(Math.max(-1, Math.min(1, (PLATFORM_SIGN * a.y) / g))) * 180) / Math.PI;
    this.ema = this.ema == null ? theta : this.ema + ALPHA * (theta - this.ema);

    const now = performance.now();
    this.win.push({ t: now, v: this.ema });
    while (this.win.length && now - this.win[0].t > WINDOW_MS) this.win.shift();

    const n = this.win.length;
    const mean = this.win.reduce((s, p) => s + p.v, 0) / n;
    const sd = Math.sqrt(this.win.reduce((s, p) => s + (p.v - mean) ** 2, 0) / n);
    const span = n > 1 ? now - this.win[0].t : 0;
    const stable = span >= WINDOW_MS * 0.8 && sd < STABLE_STD;

    const { offset, flipSign } = getSettings();
    const angle = (flipSign ? -1 : 1) * (mean - (offset ?? 0));
    this.set({ status: 'running', raw: mean, angle, stable, moving: false });
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
