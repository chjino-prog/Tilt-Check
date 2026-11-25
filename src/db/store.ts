// IndexedDB 저장소 — 블록 · 캡 · 측정기록. 모든 데이터는 이 폰 안에만 있다.
import type { Dir } from '../calc/angle';
import type { Basis } from '../calc/basis';

export interface Block {
  id: string;
  ship: string; // 호선
  block: string; // 블록
  ta: number | null; // T.A TRANSVERSE ANGLE (도면, 모르면 null)
  fa: number | null; // F.A FRAME ANGLE (도면 크기, 모르면 null)
  faDir?: Dir; // 도면 F.A 방향 선수 +1 / 선미 −1 (예전 블록은 없음 = 선수로 계산)
  refTa?: number; // 현물 T.A — DECK 상면 FRAME 라인을 폰으로 잰 값
  refFa?: number; // 현물 F.A — CENTER LINE 과 평행한 LONGL. 라인을 폰으로 잰 값
  refFaDir?: Dir; // 현물에서 잰 F.A 방향 (LONGL. 라인 높은 쪽의 반대)
  refAt?: number; // 현물값을 잰 시각
  basis?: Basis; // 계산 기준 (도면 / 현물)
  capUp?: boolean; // 턴오버 후 확인 — 지주캡이 하늘을 보는 자세에서 잼 (없으면 바닥 = 보통)
  memo: string;
  createdAt: number;
  updatedAt: number;
}

export interface Cap {
  id: string;
  blockId: string;
  no: string; // 캡 No
  delta: number; // δ (도면 캡취부각도 = 외판 면 위 각도)
  dir: Dir; // 선수 +1 / 선미 −1
  shell?: number; // 캡 자리 외판 기울기 (FR 단면에서 외판 접선과 A/B 수평선 사이, 0~90°). δ 0 캡은 없음
  createdAt: number;
}

export type Verdict = 'OK' | 'NG' | '기준미정' | '판정불가' | '양호' | '주의' | '초과' | 'θ 미입력';

export interface MeasureRecord {
  id: string;
  createdAt: number;
  blockId: string;
  ship: string;
  block: string;
  ta: number; // 계산에 쓴 T.A (실제 경사. 1.6.0 전 도면 기준 기록은 도면 값 그대로)
  taDesign?: number; // 도면 기준일 때 도면에 적힌 T.A (1.6.0 부터)
  fa: number; // 계산에 쓴 F.A (크기)
  faDir?: Dir; // 계산에 쓴 F.A 방향 (예전 기록은 없음 = 선수)
  basis?: Basis; // 그때 쓴 기준 (예전 기록은 없음 = 도면)
  mode: 'cap' | 'line';
  calcRev?: number; // 계산 방식 : 2 = 1.6.0 (외판 기울기 · 턴오버 · 도면 T.A 경사), 3 = 1.7.0 (외판 정확식 · A·B 판정). 없으면 그 전
  recalcAt?: number; // 잰 값은 그대로 두고 새 계산으로 다시 계산한 시각
  // 지주캡
  capId?: string;
  capNo?: string;
  delta?: number; // 도면 δ (외판 면 위)
  dir?: Dir;
  shell?: number; // 계산에 쓴 캡 자리 외판 기울기 (0 = 누운 외판, 없고 δ 가 있으면 'θ 미입력' 기록)
  up?: boolean; // 턴오버 후 (캡이 하늘을 보는 자세)에서 잼
  deltaCap?: number; // 계산에 쓴 캡 상판 δ
  deltaRealCap?: number | null; // B 로 역산한 실제 상판 δ
  normalA?: number;
  normalB?: number;
  measA?: number;
  measB?: number; // 계산용 부호 붙은 B (+ = F.A 반대쪽이 높음)
  highB?: Dir; // B 를 잴 때 높았던 쪽 (현장 기록 그대로)
  errA?: number;
  errB?: number;
  deltaReal?: number | null; // 실제 δ (외판 위 각도, 도면 δ 와 비교)
  rotErr?: number | null; // 회전오차 = 실제 δ − 도면 δ
  aResid?: number | null;
  // 1.7.0 판정 (A · B 현물 비교, 역산 회전은 참고)
  tol?: number; // 그 측정 때의 합격 허용오차 (°)
  rotScale?: number; // 회전 환산 배율 1 / sin(T.A)
  caution?: string; // 주의 사유 (주의일 때만)
  // 일반 부재
  lineLabel?: string; // FRAME 방향 / LONGL. 방향 / 임의각 ψ=…
  normal?: number;
  meas?: number;
  dev?: number;
  verdict: Verdict;
  memo: string;
  photo?: Blob;
}

const DB_NAME = 'tilt-check';
const DB_VER = 1;
let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('blocks')) db.createObjectStore('blocks', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('caps')) {
        db.createObjectStore('caps', { keyPath: 'id' }).createIndex('blockId', 'blockId');
      }
      if (!db.objectStoreNames.contains('records')) {
        db.createObjectStore('records', { keyPath: 'id' }).createIndex('blockId', 'blockId');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

type StoreName = 'blocks' | 'caps' | 'records';

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name: StoreName, mode: IDBTransactionMode = 'readonly') {
  const db = await open();
  return db.transaction(name, mode).objectStore(name);
}

async function getAll<T>(name: StoreName): Promise<T[]> {
  return wrap((await store(name)).getAll()) as Promise<T[]>;
}
async function getByBlock<T>(name: 'caps' | 'records', blockId: string): Promise<T[]> {
  return wrap((await store(name)).index('blockId').getAll(blockId)) as Promise<T[]>;
}
async function get<T>(name: StoreName, id: string): Promise<T | undefined> {
  return wrap((await store(name)).get(id)) as Promise<T | undefined>;
}
async function put<T>(name: StoreName, v: T): Promise<void> {
  await wrap((await store(name, 'readwrite')).put(v));
}
async function del(name: StoreName, id: string): Promise<void> {
  await wrap((await store(name, 'readwrite')).delete(id));
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ── 블록
export const listBlocks = () => getAll<Block>('blocks');
export const getBlock = (id: string) => get<Block>('blocks', id);
export const saveBlock = (b: Block) => put('blocks', b);
export async function deleteBlock(id: string) {
  for (const c of await listCaps(id)) await del('caps', c.id);
  for (const r of await listRecordsByBlock(id)) await del('records', r.id);
  await del('blocks', id);
}
/** 블록 복제 — 캡까지 함께 복사 (기록은 복사하지 않음) */
export async function duplicateBlock(id: string): Promise<Block | undefined> {
  const b = await getBlock(id);
  if (!b) return;
  const now = Date.now();
  // 현물값은 그 블록 현물에서 잰 값이라 복제본에는 옮기지 않는다
  const { refTa: _t, refFa: _f, refFaDir: _d, refAt: _a, basis: _b, ...rest } = b;
  const copy: Block = { ...rest, id: newId(), block: b.block + ' 복사', createdAt: now, updatedAt: now };
  await saveBlock(copy);
  for (const c of await listCaps(id)) await saveCap({ ...c, id: newId(), blockId: copy.id, createdAt: Date.now() });
  return copy;
}

// ── 캡
export const listCaps = (blockId: string) => getByBlock<Cap>('caps', blockId);
export const listAllCaps = () => getAll<Cap>('caps');
export const getCap = (id: string) => get<Cap>('caps', id);
export const saveCap = (c: Cap) => put('caps', c);
export const deleteCap = (id: string) => del('caps', id);

// ── 기록
export const listRecords = () => getAll<MeasureRecord>('records');
export const listRecordsByBlock = (blockId: string) => getByBlock<MeasureRecord>('records', blockId);
export const saveRecord = (r: MeasureRecord) => put('records', r);
export const deleteRecord = (id: string) => del('records', id);

/** 브라우저가 저장 공간을 정리할 때 지우지 않도록 요청 */
export function requestPersist() {
  try {
    navigator.storage?.persist?.();
  } catch {
    /* 무시 */
  }
}
