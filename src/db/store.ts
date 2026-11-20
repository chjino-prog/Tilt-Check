// IndexedDB 저장소 — 블록 · 캡 · 측정기록. 모든 데이터는 이 폰 안에만 있다.
import type { Dir } from '../calc/angle';

export interface Block {
  id: string;
  ship: string; // 호선
  block: string; // 블록
  ta: number; // T.A TRANSVERSE ANGLE
  fa: number; // F.A FRAME ANGLE
  memo: string;
  createdAt: number;
  updatedAt: number;
}

export interface Cap {
  id: string;
  blockId: string;
  no: string; // 캡 No
  delta: number; // δ (도면)
  dir: Dir; // 선수 +1 / 선미 −1
  createdAt: number;
}

export type Verdict = 'OK' | 'NG' | '기준미정' | '판정불가' | '양호' | '주의' | '초과';

export interface MeasureRecord {
  id: string;
  createdAt: number;
  blockId: string;
  ship: string;
  block: string;
  ta: number;
  fa: number;
  mode: 'cap' | 'line';
  // 지주캡
  capId?: string;
  capNo?: string;
  delta?: number;
  dir?: Dir;
  normalA?: number;
  normalB?: number;
  measA?: number;
  measB?: number;
  errA?: number;
  errB?: number;
  deltaReal?: number | null;
  rotErr?: number | null;
  aResid?: number | null;
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
  const copy: Block = { ...b, id: newId(), block: b.block + ' 복사', createdAt: now, updatedAt: now };
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
