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

/** 캡 회전 방향 글 — δ 가 0 이면 돌아간 게 없으니 빈 글 */
export function capDirText(delta: number | null | undefined, dir: 1 | -1 | undefined): string {
  if (delta == null || Math.abs(delta) < 1e-9 || dir == null) return '';
  return dir === 1 ? '선수' : '선미';
}

/** 숫자 표시 : 소수 자릿수, −0 방지, 빼기표는 화면 글꼴에 맞춰 '−' 하나로 */
export function fmt(v: number | null | undefined, d: number): string {
  if (v == null || !isFinite(v)) return '—';
  const s = v.toFixed(d);
  if (/^-0\.?0*$/.test(s)) return s.slice(1);
  return s.startsWith('-') ? '−' + s.slice(1) : s;
}

/** 부호 붙인 숫자 (+1.2 / −0.4) */
export function fmtSigned(v: number | null | undefined, d: number): string {
  if (v == null || !isFinite(v)) return '—';
  const s = fmt(v, d);
  if (s.startsWith('−')) return s;
  return Number(s) === 0 ? s : '+' + s;
}

/** 1.2.0 전 지주캡 기록 — F.A 방향 · 높은 쪽 없이, 예전 식(F.A 늘 선수)으로 계산된 값 */
export function isLegacyCap(r: MeasureRecord): boolean {
  return r.mode === 'cap' && r.faDir == null && r.highB == null;
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

/**
 * 같은 블록에서 (캡별 최근) 회전오차가 모두 같은 쪽으로 돌았으면 → 마킹기준 · 방향 · 세팅 확인 경고
 * 캡마다 돌아간 방향(선수/선미)이 달라도 비교되게 '선수 쪽으로 돌았으면 +' 로 바꿔 본다.
 * (블록 세팅 · 마킹 기준이 틀어지면 캡 방향과 상관없이 모두 같은 쪽으로 돈 것처럼 나온다)
 * 1.2.0 전 기록은 방향 계산이 달라 뺀다.
 */
export function sameSignWarning(records: MeasureRecord[]): { warn: boolean; sign: number; count: number } {
  const errs = [...latestPerCap(records.filter((r) => !isLegacyCap(r))).values()]
    .map((r) => (r.rotErr == null ? null : r.rotErr * (r.dir ?? 1)))
    .filter((e): e is number => e != null && isFinite(e) && Math.abs(e) >= 0.005);
  if (errs.length < 2) return { warn: false, sign: 0, count: errs.length };
  const pos = errs.every((e) => e > 0);
  const neg = errs.every((e) => e < 0);
  return { warn: pos || neg, sign: pos ? 1 : neg ? -1 : 0, count: errs.length };
}
