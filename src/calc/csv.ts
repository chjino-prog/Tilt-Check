// CSV 내보내기 — 작업지시서 5-4 저장 항목 순서
import type { MeasureRecord } from '../db/store';
import { capDirText, fmtDate } from './judge';

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
];

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
      ];
    });
  // 엑셀에서 한글이 깨지지 않도록 BOM + CRLF
  return '﻿' + [CSV_HEADER, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/** 공유 시트(폰) 또는 내려받기(PC) */
export async function shareCsv(records: MeasureRecord[], name: string) {
  const blob = new Blob([recordsToCsv(records)], { type: 'text/csv;charset=utf-8' });
  const file = new File([blob], name, { type: 'text/csv' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
