// 설정 — 기기별로 다르므로 이 폰의 localStorage 에 둔다
import { useEffect, useState } from 'preact/hooks';
import type { Dir } from './calc/angle';

export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  tol1: number; // 일반 편차 1단계 (녹색)
  tol2: number; // 일반 편차 2단계 (주황)
  rotTol: number | null; // 허용 회전오차 (없으면 기준미정)
  aResidTol: number; // A 잔차 경고 기준
  aSensMin: number; // A 민감도 하한 (dA 가 이보다 작으면 A 는 참고)
  decimals: 1 | 2;
  vibrate: boolean;
  flipSign: boolean; // ▲▼ 방향 반대로 (기기 센서 부호가 다를 때)
  theme: Theme;
  offset: number | null; // 영점 보정값 (°)
  headDir: Dir; // B · LONGL. 라인 잴 때 폰 머리가 향한 쪽 (마지막 고른 값)
}

export const DEFAULTS: Settings = {
  tol1: 0.5,
  tol2: 1.0,
  rotTol: null,
  aResidTol: 0.5,
  aSensMin: 0.3,
  decimals: 1,
  vibrate: true,
  flipSign: false,
  theme: 'system',
  offset: null,
  headDir: 1,
};

const KEY = 'tiltcheck.settings.v1';
const listeners = new Set<(s: Settings) => void>();

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* 저장소를 못 쓰는 환경 — 기본값 사용 */
  }
  return { ...DEFAULTS };
}

let current = load();

export function getSettings(): Settings {
  return current;
}

export function setSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* 무시 */
  }
  listeners.forEach((l) => l(current));
}

export function useSettings(): Settings {
  const [s, set] = useState(current);
  useEffect(() => {
    listeners.add(set);
    return () => void listeners.delete(set);
  }, []);
  return s;
}
