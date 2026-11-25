/**
 * 지주캡 계측 보고서 (A4 한 장, 결재용) — 화면과 무관한 순수 정리 함수
 *
 * 블록 · 캡 · 기록을 받아 캡마다 가장 최근 기록 하나로 표를 만든다.
 *  - 1.2.0 전 기록(방향 없이 계산)은 빼고 몇 건 뺐는지만 알린다.
 *  - 기록이 없는 캡은 '미측정' 줄로 남겨 빠진 캡이 보이게 한다.
 *  - 판정은 지금 설정의 합격 허용오차로 다시 매긴다 (보고서에 적힌 허용값과 맞게).
 *    1.7.0 : 판정 = A · B 현물 비교 (OK / 주의 / NG), 역산 회전오차는 참고.
 */
import type { Dir } from './angle';
import { basisName, designSlope, effectiveAngles, hasDesign, hasRef, type Basis } from './basis';
import { LOW_TA, capJudge, cautionText, isLegacyCap, latestPerCap, sameSignWarning } from './judge';
import { capDirOf, dirSuspect, highOfB, rotText, rotToBow } from './sign';
import type { Block, Cap, MeasureRecord, Verdict } from '../db/store';
import type { Settings } from '../settings';

export interface ReportRow {
  capNo: string;
  delta: number;
  capDir: Dir;
  measured: boolean;
  normalB?: number;
  measB?: number;
  highB?: Dir | null; // 실측 B 높은 쪽 (거의 수평이면 null)
  normalA?: number;
  measA?: number;
  errA?: number; // A 실측 − 정상
  errB?: number; // B 실측 − 정상 (계산용 부호)
  rotErr?: number | null; // 계산용 부호 (역산 못 하면 null)
  rotBow?: number | null; // 선수 쪽으로 돌았으면 +
  rotText?: string; // '선수 쪽으로 0.35° 돌아감'
  verdict?: Verdict;
  caution?: string; // 주의 사유
  dirWarn?: boolean; // 캡 · F.A 방향이 반대로 들어간 것 같음
  shell?: number; // 계산에 쓴 캡 자리 외판 기울기
  noShell?: boolean; // δ 가 있는데 외판 기울기 없이 계산한 기록
  up?: boolean; // 턴오버 후(캡이 하늘을 봄)에 잰 기록
  at?: number;
}

export interface AnglePair {
  ta: number; // 도면이면 도면에 적힌 값, 현물이면 폰이 잰 경사
  fa: number;
  faDir?: Dir;
  slope?: number; // 도면 T.A 를 실제 경사로 바꾼 값 (도면만)
}

export interface Report {
  ship: string;
  block: string;
  from: number | null; // 첫 측정 시각
  to: number | null; // 마지막 측정 시각
  basis: Basis;
  design: AnglePair | null;
  ref: AnglePair | null;
  taDiff: number | null; // |도면 − 현물|
  faDiff: number | null;
  faDirSame: boolean | null; // 도면 · 현물 F.A 방향이 같은가 (둘 중 하나라도 없으면 null)
  rows: ReportRow[];
  caps: number; // 블록에 등록된 캡 수
  measured: number;
  ok: number;
  caution: number; // 주의 (A · B 는 안, 역산 회전 이상)
  ng: number;
  undecided: number; // 판정불가 (방향 보류)
  worst: ReportRow | null; // A · B 편차가 가장 큰 캡
  tol: number;
  lowTa: boolean; // T.A 24° 미만 — 역산 회전이 크게 부풀려지는 블록
  aMaxDiff: number | null; // max |A 실측 − 정상|
  aOk: boolean | null; // A 가 정상값과 다 맞는가 (A 잔차 경고 기준 안)
  dirWarnCaps: string[];
  noShellCaps: string[]; // δ 가 있는데 외판 기울기 없이 계산한 캡
  turned: boolean; // 턴오버 후(캡이 하늘을 봄)에 잰 기록이 있음
  sameSign: { warn: boolean; sign: number };
  skippedLegacy: number;
}

/** 기준 비교에서 '같다'고 볼 차이 (°) */
export const BASIS_DIFF_OK = 0.5;

export function buildReport(block: Block, caps: Cap[], records: MeasureRecord[], s: Settings): Report {
  const capRecs = records.filter((r) => r.mode === 'cap');
  const legacy = capRecs.filter(isLegacyCap);
  const valid = capRecs.filter((r) => !isLegacyCap(r));
  const latest = latestPerCap(valid);

  const sorted = [...caps].sort((a, b) => a.no.localeCompare(b.no, 'ko', { numeric: true }));
  const rows: ReportRow[] = sorted.map((c) => {
    const r = latest.get(c.id);
    const capDir = capDirOf(c.delta, c.dir);
    if (!r) return { capNo: c.no, delta: c.delta, capDir, measured: false };
    const faDir = r.faDir ?? 1;
    const delta = r.delta ?? c.delta;
    const dir = capDirOf(delta, r.dir ?? c.dir);
    const rot = r.rotErr ?? null;
    const g = { shell: r.shell, up: r.up }; // 그 기록을 계산한 조건 그대로
    const dw =
      r.measA != null && r.ta != null && r.fa != null ? dirSuspect(r.ta, r.fa, faDir, delta, r.dir ?? c.dir, r.measA, g) != null : false;
    const j = r.errA != null && r.errB != null ? capJudge(r.errA, r.errB, rot, r.ta, s.capTol) : null;
    return {
      capNo: r.capNo ?? c.no,
      delta,
      capDir: dir,
      measured: true,
      normalB: r.normalB,
      measB: r.measB,
      highB: r.measB != null ? r.highB ?? highOfB(r.measB, faDir) : null,
      normalA: r.normalA,
      measA: r.measA,
      errA: r.errA,
      errB: r.errB,
      rotErr: rot,
      rotBow: rot == null ? null : rotToBow(rot, delta, dir),
      rotText: rot == null ? '역산 불가' : rotText(rot, delta, dir),
      verdict: dw || !j ? '판정불가' : j.verdict,
      caution: !dw && j ? cautionText(j) || undefined : undefined,
      dirWarn: dw,
      shell: r.shell,
      noShell: Math.abs(delta) >= 1e-9 && r.shell == null,
      up: r.up,
      at: r.createdAt,
    };
  });

  const m = rows.filter((r) => r.measured);
  const times = m.map((r) => r.at!);
  const dev = (r: ReportRow) => Math.max(Math.abs(r.errA!), Math.abs(r.errB!));
  const withDev = m.filter((r) => r.errA != null && r.errB != null && !r.dirWarn);
  const worst = withDev.length ? withDev.reduce((a, r) => (dev(r) > dev(a) ? r : a)) : null;
  const lastTa = [...latest.values()].sort((a, b) => b.createdAt - a.createdAt)[0]?.ta;
  const aDiffs = m.filter((r) => r.measA != null && r.normalA != null).map((r) => Math.abs(Math.abs(r.measA!) - Math.abs(r.normalA!)));
  const aMaxDiff = aDiffs.length ? Math.max(...aDiffs) : null;

  const design = hasDesign(block)
    ? { ta: Math.abs(block.ta!), fa: Math.abs(block.fa!), faDir: block.faDir, slope: designSlope(block.ta!, block.fa!) }
    : null;
  const ref = hasRef(block) ? { ta: Math.abs(block.refTa!), fa: Math.abs(block.refFa!), faDir: block.refFaDir } : null;
  // 보고서 기준 = 표에 쓴 기록들이 쓴 기준 (최근 기록 우선), 기록이 없으면 블록의 지금 기준
  const lastRec = [...latest.values()].sort((a, b) => b.createdAt - a.createdAt)[0];
  const basis: Basis = lastRec ? lastRec.basis ?? 'design' : effectiveAngles(block)?.basis ?? 'design';
  const ss = sameSignWarning(valid);

  return {
    ship: block.ship,
    block: block.block,
    from: times.length ? Math.min(...times) : null,
    to: times.length ? Math.max(...times) : null,
    basis,
    design,
    ref,
    taDiff: design && ref ? Math.abs(design.slope - ref.ta) : null, // 현물은 경사를 재므로 도면도 경사로 비교
    faDiff: design && ref ? Math.abs(design.fa - ref.fa) : null,
    faDirSame: design?.faDir != null && ref?.faDir != null ? design.faDir === ref.faDir : null,
    rows,
    caps: caps.length,
    measured: m.length,
    ok: m.filter((r) => r.verdict === 'OK').length,
    caution: m.filter((r) => r.verdict === '주의').length,
    ng: m.filter((r) => r.verdict === 'NG').length,
    undecided: m.filter((r) => r.verdict !== 'OK' && r.verdict !== 'NG' && r.verdict !== '주의').length,
    worst,
    tol: s.capTol,
    lowTa: lastTa != null && Math.abs(lastTa) < LOW_TA,
    aMaxDiff,
    aOk: aMaxDiff == null ? null : aMaxDiff <= s.aResidTol + 1e-9 && !m.some((r) => r.dirWarn),
    dirWarnCaps: m.filter((r) => r.dirWarn).map((r) => r.capNo),
    noShellCaps: m.filter((r) => r.noShell).map((r) => r.capNo),
    turned: m.some((r) => r.up),
    sameSign: { warn: ss.warn, sign: ss.sign },
    skippedLegacy: legacy.length,
  };
}

/** 보고서 날짜 표기 : 26.11.22 */
export function shortDate(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${String(d.getFullYear()).slice(2)}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

export function hhmm(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 측정일 칸 : '26.11.22 09:12 ~ 10:05' / 여러 날이면 '26.11.21 ~ 26.11.22' */
export function spanText(from: number | null, to: number | null): { day: string; time: string } {
  if (from == null || to == null) return { day: '', time: '' };
  const a = shortDate(from);
  const b = shortDate(to);
  if (a !== b) return { day: `${a} ~ ${b}`, time: '' };
  return { day: a, time: from === to ? hhmm(from) : `${hhmm(from)} ~ ${hhmm(to)}` };
}

/** PDF 파일 이름 (인쇄 창의 기본 파일 이름이 문서 제목을 따른다) */
export function reportFileName(rep: Report, now = Date.now()): string {
  const safe = (v: string) => v.replace(/[\\/:*?"<>|]/g, '_').trim();
  return `TILTCHECK_${safe(rep.ship)}_${safe(rep.block)}_지주캡보고서_${shortDate(now).replace(/\./g, '')}`;
}

export { basisName };
