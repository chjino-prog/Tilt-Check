// 설정 — 기기별로 다르므로 이 폰의 localStorage 에 둔다
import { useEffect, useState } from 'preact/hooks';

export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  tol1: number; // 일반 편차 1단계 (녹색)
  tol2: number; // 일반 편차 2단계 (주황)
  capTol: number; // 지주캡 합격 허용오차 (°) — A · B 편차와 역산 회전 이상 판단에 같이 쓴다 (1.7.0)
  aResidTol: number; // A 잔차 경고 기준
  aSensMin: number; // A 민감도 하한 (dA 가 이보다 작으면 A 는 참고)
  decimals: 1 | 2;
  vibrate: boolean;
  flipSign: boolean; // ▲▼ 방향 반대로 (기기 센서 부호가 다를 때 — 영점 보정 3단계에서 저절로 정함)
  theme: Theme;
  offset: number | null; // 영점 보정값 (°)
  faceBias: number | null; // 뒷면 보정 : 화면 축 센서 치우침 (중력 1 기준). 판 기울기 재기에 쓴다
  faceSign: 1 | -1; // 화면이 하늘을 볼 때 + 가 되게 하는 부호 (뒷면 보정에서 저절로 정함)
}

export const DEFAULTS: Settings = {
  tol1: 0.5,
  tol2: 1.0,
  capTol: 3.0,
  aResidTol: 0.5,
  aSensMin: 0.3,
  decimals: 1,
  vibrate: true,
  flipSign: false,
  theme: 'system',
  offset: null,
  faceBias: null,
  faceSign: 1,
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
