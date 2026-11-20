// 판정 · 표시 도우미 (화면에서 쓰는 작은 규칙들)
import type { Settings } from '../settings';
import type { MeasureRecord, Verdict } from '../db/store';

export type Level = 'good' | 'warn' | 'bad' | 'none';

/** 일반 편차 색 : ≤허용1 녹색 / ≤허용2 주황 / 초과 빨강 */
export function devLevel(dev: number | null | undefined, s: Settings): Level {
  if (dev == null || !isFinite(dev)) return 'none';
  const a = Math.abs(dev);
  if (a <= s.tol1 + 1e-9) return 'good';
  if (a <= s.tol2 + 1e-9) return 'warn';
  return 'bad';
}

export function lineVerdict(dev: number, s: Settings): Verdict {
  const l = devLevel(dev, s);
  return l === 'good' ? '양호' : l === 'warn' ? '주의' : '초과';
}

export function capVerdict(rotErr: number | null, s: Settings): Verdict {
  if (rotErr == null) return '판정불가';
  if (s.rotTol == null) return '기준미정';
  return Math.abs(rotErr) <= s.rotTol + 1e-9 ? 'OK' : 'NG';
}

export function verdictLevel(v: Verdict): Level {
  if (v === 'OK' || v === '양호') return 'good';
  if (v === '주의') return 'warn';
  if (v === 'NG' || v === '초과') return 'bad';
  return 'none';
}

/** 숫자 표시 : 소수 자릿수, −0 방지 */
export function fmt(v: number | null | undefined, d: number): string {
  if (v == null || !isFinite(v)) return '—';
  const s = v.toFixed(d);
  return /^-0\.?0*$/.test(s) ? s.slice(1) : s;
}

/** 부호 붙인 숫자 (+1.2 / −0.4) */
export function fmtSigned(v: number | null | undefined, d: number): string {
  if (v == null || !isFinite(v)) return '—';
  const s = fmt(v, d);
  if (s.startsWith('-')) return '−' + s.slice(1);
  return Number(s) === 0 ? s : '+' + s;
}

export function fmtDate(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 입력 문자열 → 숫자 (빈칸 · 잘못된 값은 null) */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.').replace('−', '-');
  if (t === '' || t === '-' || t === '.') return null;
  const n = Number(t);
  return isFinite(n) ? n : null;
}

/** 캡마다 가장 최근 지주캡 기록만 골라낸다 */
export function latestPerCap(records: MeasureRecord[]): Map<string, MeasureRecord> {
  const m = new Map<string, MeasureRecord>();
  for (const r of records) {
    if (r.mode !== 'cap' || !r.capId) continue;
    const old = m.get(r.capId);
    if (!old || old.createdAt < r.createdAt) m.set(r.capId, r);
  }
  return m;
}

/** 같은 블록에서 (캡별 최근) 회전오차 부호가 모두 같으면 → 마킹기준 · 방향 · 세팅 확인 경고 */
export function sameSignWarning(records: MeasureRecord[]): { warn: boolean; sign: number; count: number } {
  const errs = [...latestPerCap(records).values()]
    .map((r) => r.rotErr)
    .filter((e): e is number => e != null && isFinite(e) && Math.abs(e) >= 0.005);
  if (errs.length < 2) return { warn: false, sign: 0, count: errs.length };
  const pos = errs.every((e) => e > 0);
  const neg = errs.every((e) => e < 0);
  return { warn: pos || neg, sign: pos ? 1 : neg ? -1 : 0, count: errs.length };
}
