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

/**
 * 지주캡 판정 (1.7.0) — 합격 · 불합격은 A · B 현물 실측과 정상값의 단순 비교로 정한다.
 * 역산 회전각은 B 를 거꾸로 풀어 구해서 B 측정 오차가 1/sin(T.A) 배로 커진다
 * (T.A 17° 블록이면 B 1° 오차 → 회전 3.3°). 그래서 판정에는 쓰지 않고 '주의' 만 띄운다.
 *   NG   : |A 편차| 또는 |B 편차| > 허용오차
 *   주의 : A · B 는 안인데 역산 회전오차가 허용오차를 넘거나 역산이 안 됨
 *   OK   : 둘 다 아님
 */
export type CapCaution = 'rot' | 'noinv';

export interface CapJudge {
  verdict: 'OK' | '주의' | 'NG';
  tol: number; // 판정에 쓴 허용오차
  caution: CapCaution | null; // 주의 사유 (NG · OK 면 null)
  scale: number; // 회전 환산 배율 = 1 / sin(T.A) — B 1° 가 회전 몇 ° 로 보이는지
  lowTa: boolean; // T.A 24° 미만 (배율 2.5 초과) — 역산 회전각이 크게 부풀려지는 블록
}

/** T.A 가 이보다 작으면 역산 회전각을 믿기 어렵다고 알린다 (배율 > 2.5) */
export const LOW_TA = 24;

/** 회전 환산 배율 1 / sin(T.A) */
export const rotScale = (ta: number) => 1 / Math.sin((Math.abs(ta) * Math.PI) / 180);

export function capJudge(errA: number, errB: number, rotErr: number | null | undefined, ta: number, tol: number): CapJudge {
  const t = Math.abs(tol) + 1e-9;
  const scale = rotScale(ta);
  const lowTa = Math.abs(ta) < LOW_TA;
  const base = { tol: Math.abs(tol), scale, lowTa };
  if (!(Math.abs(errA) <= t) || !(Math.abs(errB) <= t)) return { verdict: 'NG', caution: null, ...base };
  if (rotErr == null || !isFinite(rotErr)) return { verdict: '주의', caution: 'noinv', ...base };
  if (Math.abs(rotErr) > t) return { verdict: '주의', caution: 'rot', ...base };
  return { verdict: 'OK', caution: null, ...base };
}

/** 주의 사유 — 짧은 글 (기록 · CSV · 목록) */
export function cautionText(j: Pick<CapJudge, 'caution' | 'scale' | 'lowTa'>): string {
  if (!j.caution) return '';
  const head = j.caution === 'noinv' ? '역산 불가' : '역산 회전각이 허용오차를 넘음 – 캡 회전 재확인';
  return j.lowTa ? `${head} · T.A 24° 미만 (회전 ${fmt(j.scale, 1)}배 증폭)` : head;
}

/** 주의 사유 — T.A 24° 미만일 때 함께 보여주는 설명 */
export function lowTaText(scale: number): string {
  const n = fmt(scale, 1);
  return `T.A가 24° 미만이라 B각 오차가 역산 회전각에 약 ${n}배로 커집니다(이 블록 N = ${n}). 역산 회전각이 크게 나와도 실제로 캡이 그만큼 틀어졌다고 볼 수 없습니다. A·B 현물 비교 결과를 기준으로 판단하세요.`;
}

export function verdictLevel(v: Verdict): Level {
  if (v === 'OK' || v === '양호') return 'good';
  if (v === '주의') return 'warn';
  if (v === 'NG' || v === '초과') return 'bad';
  return 'none'; // 기준미정 · 판정불가 · θ 미입력
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
