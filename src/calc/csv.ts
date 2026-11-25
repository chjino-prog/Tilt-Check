// CSV 내보내기 — 작업지시서 5-4 저장 항목 순서
import type { MeasureRecord } from '../db/store';
import { capDirText, fmtDate, isLegacyCap, rotScale } from './judge';
import { calcRevName } from './capcalc';
import { dirName, highOfB } from './sign';

export const CSV_HEADER = [
  '일시',
  '호선',
  '블록',
  '모드',
  '캡No',
  '측정방향',
  'T.A',
  'F.A',
  'δ(도면)',
  '회전방향',
  '정상값A',
  '정상값B',
  '실측값A',
  '실측값B',
  '편차A',
  '편차B',
  'δ_real',
  '회전오차',
  'A잔차',
  '판정',
  '메모',
  '기준',
  'F.A방향',
  '실측B높은쪽',
  '정상B높은쪽',
  // 1.6.0 — 끝에 붙여 예전 칸 위치는 그대로
  '외판기울기',
  'δ상판(계산)',
  '실제δ상판',
  '캡자세',
  '도면T.A',
  '계산방식',
  // 1.7.0 — 판정 = A · B 현물 비교, 역산 회전은 참고
  '판정기준(A·B)',
  '역산회전(참고)',
  '회전 환산 배율',
  '경고(주의 사유)',
  '허용오차',
];

const side = (d: 1 | -1 | null | undefined) => (d == null ? '수평' : dirName(d));
const n = (v: number | null | undefined, d = 2) => (v == null || !isFinite(v) ? '' : v.toFixed(d));

/** 1.7.0 판정 칸 — 허용오차가 남은 기록(1.7.0 계산)만 채운다 */
function abCells(r: MeasureRecord): string[] {
  if (r.mode !== 'cap') return ['', '', '', '', ''];
  const tol = r.tol;
  const judged = tol != null && r.errA != null && r.errB != null;
  const abOk = judged && Math.abs(r.errA!) <= tol + 1e-9 && Math.abs(r.errB!) <= tol + 1e-9;
  const rot = !judged ? '' : r.rotErr == null ? '역산 불가' : `${n(r.rotErr)}${Math.abs(r.rotErr) > tol + 1e-9 ? ' 초과' : ''}`;
  const scale = r.rotScale ?? (r.ta ? rotScale(r.ta) : null);
  return [judged ? (abOk ? 'OK' : 'NG') : '', rot, n(scale, 1), r.caution ?? '', judged ? n(tol, 1) : ''];
}

function cell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function recordsToCsv(records: MeasureRecord[]): string {
  const rows = [...records]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((r) => {
      const cap = r.mode === 'cap';
      const legacy = isLegacyCap(r); // 1.2.0 전 기록 : 높은 쪽을 몰라 비운다
      return [
        fmtDate(r.createdAt),
        r.ship,
        r.block,
        cap ? '지주캡' : '일반부재',
        cap ? r.capNo ?? '' : '',
        cap ? '' : r.lineLabel ?? '',
        n(r.ta, 3),
        n(r.fa, 3),
        cap ? n(r.delta) : '',
        cap ? capDirText(r.delta, r.dir) : '',
        cap ? n(r.normalA) : n(r.normal),
        cap ? n(r.normalB) : '',
        cap ? n(r.measA) : n(r.meas),
        cap ? n(r.measB) : '',
        cap ? n(r.errA) : n(r.dev),
        cap ? n(r.errB) : '',
        cap ? n(r.deltaReal) : '',
        cap ? n(r.rotErr) : '',
        cap ? n(r.aResid) : '',
        r.verdict,
        legacy ? ['(1.2.0 전 계산 방식)', r.memo].filter(Boolean).join(' ') : (r.memo ?? ''),
        r.basis === 'ref' ? '현물' : '도면',
        r.faDir != null ? dirName(r.faDir) : '',
        cap && !legacy && r.measB != null ? side(r.highB ?? highOfB(r.measB, r.faDir ?? 1)) : '',
        cap && !legacy && r.normalB != null ? side(highOfB(r.normalB, r.faDir ?? 1)) : '',
        cap ? n(r.shell, 1) : '',
        cap ? n(r.deltaCap) : '',
        cap ? n(r.deltaRealCap) : '',
        cap && r.calcRev ? (r.up ? '하늘(턴오버 후)' : '바닥') : '',
        n(r.taDesign, 3),
        cap || r.calcRev ? calcRevName(r.calcRev) + (r.calcRev && r.recalcAt ? ' 다시 계산' : '') : '',
        ...abCells(r),
      ];
    });
  // 엑셀에서 한글이 깨지지 않도록 BOM + CRLF
  return '﻿' + [CSV_HEADER, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

const csvBlob = (records: MeasureRecord[]) => new Blob([recordsToCsv(records)], { type: 'text/csv;charset=utf-8' });

/** 공유 시트로 파일을 보낼 수 있는 폰인지 */
export function canShareFile(): boolean {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  try {
    return !!nav.canShare?.({ files: [new File([''], 'a.csv', { type: 'text/csv' })] });
  } catch {
    return false;
  }
}

/** 다운로드 폴더에 저장 (안드로이드 크롬 = 내 파일 › 다운로드, PC = 다운로드 폴더) */
export function downloadCsv(records: MeasureRecord[], name: string) {
  const url = URL.createObjectURL(csvBlob(records));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** 다른 앱으로 보내기 (공유 시트). 못 쓰는 기기면 다운로드로 */
export async function shareCsv(records: MeasureRecord[], name: string) {
  const file = new File([csvBlob(records)], name, { type: 'text/csv' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return;
    }
  }
  downloadCsv(records, name);
}
