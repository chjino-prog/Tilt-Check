// CSV 내보내기 — 작업지시서 5-4 저장 항목 순서
import type { MeasureRecord } from '../db/store';
import { capDirText, fmtDate } from './judge';
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
];

const side = (d: 1 | -1 | null | undefined) => (d == null ? '수평' : dirName(d));
const n = (v: number | null | undefined, d = 2) => (v == null || !isFinite(v) ? '' : v.toFixed(d));

function cell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function recordsToCsv(records: MeasureRecord[]): string {
  const rows = [...records]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((r) => {
      const cap = r.mode === 'cap';
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
        r.memo ?? '',
        r.basis === 'ref' ? '현물' : '도면',
        r.faDir != null ? dirName(r.faDir) : '',
        cap && r.measB != null ? side(r.highB ?? highOfB(r.measB, r.faDir ?? 1)) : '',
        cap && r.normalB != null ? side(highOfB(r.normalB, r.faDir ?? 1)) : '',
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
