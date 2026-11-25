// 캡의 외판 기울기 θ 를 넣거나 고쳤을 때 — 그 캡의 지난 기록을 잰 값 그대로 다시 계산해 저장한다.
// (θ 가 설계 반영 전이라 현장에서 먼저 재고, 사무실에서 θ 를 넣으면 결과가 나오게)
import { recalcCapRecord } from '../calc/capcalc';
import { isLegacyCap } from '../calc/judge';
import { getSettings } from '../settings';
import { getBlock, listRecordsByBlock, saveRecord, type Cap, type MeasureRecord } from './store';

/** 다시 계산해 바뀐 기록만 저장하고, 저장한 기록을 돌려준다 */
export async function recalcCapRecords(cap: Cap): Promise<MeasureRecord[]> {
  const [block, recs] = await Promise.all([getBlock(cap.blockId), listRecordsByBlock(cap.blockId)]);
  const s = getSettings();
  const out: MeasureRecord[] = [];
  for (const r of recs) {
    if (r.mode !== 'cap' || r.capId !== cap.id || isLegacyCap(r)) continue;
    const re = recalcCapRecord(r, cap, block, s);
    if (!re || !re.changed) continue;
    await saveRecord(re.next);
    out.push(re.next);
  }
  return out;
}
