// 측정 중간 저장 — 두 방향 중 한 방향만 재고 화면을 나가도 잰 값이 남게 한다.
// 기록(IndexedDB)과 달리 임시값이라 이 폰의 localStorage 에 두고, 기록을 저장하면 지운다.
import type { Dir } from '../calc/angle';

export interface Reading {
  v: number; // 크기 (부호 없음)
  high?: Dir; // 높은 쪽 (B · LONGL. 라인만)
  at: number; // 잰 시각
  manual?: boolean; // 직접 입력(디지털 수평계)
  method?: 'web' | 'line'; // 현물 F.A : FRAME 웹 판 기울기 / LONGL. 라인 (없으면 라인)
}

export interface Draft {
  first?: Reading; // 지주캡 = 각도 B, 현물 기준 = T.A
  second?: Reading; // 지주캡 = 각도 A, 현물 기준 = F.A
}

const KEEP_MS = 24 * 60 * 60 * 1000; // 하루 지난 임시값은 버린다
const key = (kind: 'cap' | 'ref', id: string) => `tiltcheck.draft.${kind}.${id}`;

export function loadDraft(kind: 'cap' | 'ref', id: string): Draft {
  try {
    const raw = localStorage.getItem(key(kind, id));
    if (!raw) return {};
    const d = JSON.parse(raw) as Draft;
    const fresh = (r?: Reading) => (r && Date.now() - r.at < KEEP_MS && isFinite(r.v) ? r : undefined);
    return { first: fresh(d.first), second: fresh(d.second) };
  } catch {
    return {};
  }
}

export function saveDraft(kind: 'cap' | 'ref', id: string, d: Draft) {
  try {
    if (!d.first && !d.second) localStorage.removeItem(key(kind, id));
    else localStorage.setItem(key(kind, id), JSON.stringify(d));
  } catch {
    /* 저장소를 못 쓰는 환경 — 화면 안에서만 유지 */
  }
}

export function clearDraft(kind: 'cap' | 'ref', id: string) {
  saveDraft(kind, id, {});
}
