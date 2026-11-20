// 기록 : 블록별 목록 → 블록 기록 (경고 배너 · CSV 내보내기 · 상세/삭제)
import { useEffect, useMemo, useState } from 'preact/hooks';
import { fmt, fmtDate, fmtSigned, sameSignWarning, verdictLevel } from '../../calc/judge';
import { shareCsv } from '../../calc/csv';
import { deleteRecord, getBlock, listBlocks, listRecords, listRecordsByBlock, type Block, type MeasureRecord } from '../../db/store';
import { useSettings } from '../../settings';
import { go } from '../router';
import { BrandBar, ConfirmSheet, Empty, Headline, Seg, Sheet, TopBar, toast } from '../components/ui';
import { IChevron, IShare, ITabRecord, IWarn } from '../icons';
import { SameSignBanner } from './block';

const today = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

export function RecordsScreen() {
  const [records, setRecords] = useState<MeasureRecord[] | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  useEffect(() => {
    Promise.all([listRecords(), listBlocks()]).then(([r, b]) => {
      setRecords(r);
      setBlocks(b);
    });
  }, []);

  const groups = useMemo(() => {
    if (!records) return [];
    const byBlock = new Map<string, MeasureRecord[]>();
    records.forEach((r) => byBlock.set(r.blockId, [...(byBlock.get(r.blockId) ?? []), r]));
    const rows = [...byBlock.entries()].map(([blockId, list]) => {
      const b = blocks.find((x) => x.id === blockId);
      const last = Math.max(...list.map((r) => r.createdAt));
      return { blockId, ship: b?.ship ?? list[0].ship, block: b?.block ?? list[0].block, list, last, warn: sameSignWarning(list).warn };
    });
    const byShip = new Map<string, typeof rows>();
    rows.forEach((r) => byShip.set(r.ship, [...(byShip.get(r.ship) ?? []), r]));
    return [...byShip.entries()]
      .map(([ship, list]) => ({ ship, list: list.sort((a, b) => b.last - a.last), last: Math.max(...list.map((x) => x.last)) }))
      .sort((a, b) => b.last - a.last);
  }, [records, blocks]);

  const empty = records != null && records.length === 0;

  return (
    <div class="screen with-tab no-cta">
      <BrandBar
        right={
          !empty && records ? (
            <button class="icon-btn" aria-label="전체 CSV 내보내기" onClick={() => shareCsv(records, `TILTCHECK_전체_${today()}.csv`)}>
              <IShare />
            </button>
          ) : undefined
        }
      />
      <Headline title="기록" sub={records && !empty ? `${records.length}건 · 블록별로 모아 봐요` : undefined} />
      {empty ? (
        <Empty icon={ITabRecord} title="아직 기록이 없어요" sub="측정 결과에서 ‘기록 저장’을 누르면 여기에 모여요" />
      ) : (
        groups.map((g) => (
          <div style={{ marginBottom: '12px' }}>
            <div class="section-title">
              <span>{g.ship} 호선</span>
            </div>
            <div class="list">
              {g.list.map((r) => (
                <button class="row" onClick={() => go('/records/' + r.blockId)}>
                  <div class="lead">{r.block.slice(0, 3)}</div>
                  <div class="body">
                    <div class="t1">{r.block}</div>
                    <div class="t2 num">
                      {r.list.length}건 · 마지막 {fmtDate(r.last).slice(5)}
                    </div>
                  </div>
                  <div class="tail">
                    {r.warn && (
                      <span class="c-warn" style={{ width: '20px', height: '20px', display: 'inline-flex' }} aria-label="확인 필요">
                        <IWarn />
                      </span>
                    )}
                    <span class="chev">
                      <IChevron />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

type Filter = 'all' | 'cap' | 'line';

function summary(r: MeasureRecord, d: number): string {
  if (r.mode === 'cap') {
    if (r.rotErr == null) return `B ${fmtSigned(r.measB, 2)}° · 역산 불가`;
    return `회전오차 ${fmtSigned(r.rotErr, 2)}° · A잔차 ${fmtSigned(r.aResid, 2)}°`;
  }
  return `실측 ${fmt(Math.abs(r.meas ?? NaN), d)}° · 편차 ${fmtSigned(r.dev, d)}°`;
}

export function BlockRecordsScreen(p: { blockId: string }) {
  const s = useSettings();
  const [block, setBlock] = useState<Block | null>(null);
  const [records, setRecords] = useState<MeasureRecord[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<MeasureRecord | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const load = async () => {
    const [b, rs] = await Promise.all([getBlock(p.blockId), listRecordsByBlock(p.blockId)]);
    setBlock(b ?? null);
    setRecords(rs.sort((a, b) => b.createdAt - a.createdAt));
  };
  useEffect(() => {
    load();
  }, [p.blockId]);

  const name = block?.block ?? records?.[0]?.block ?? '';
  const ship = block?.ship ?? records?.[0]?.ship ?? '';
  const shown = (records ?? []).filter((r) => filter === 'all' || r.mode === filter);
  const byDay = new Map<string, MeasureRecord[]>();
  shown.forEach((r) => {
    const k = fmtDate(r.createdAt).slice(0, 10);
    byDay.set(k, [...(byDay.get(k) ?? []), r]);
  });

  return (
    <div class="screen no-cta">
      <TopBar
        title={name ? `${name} 기록` : '기록'}
        backTo="/records"
        right={
          records && records.length > 0 ? (
            <button class="icon-btn" aria-label="CSV 내보내기" onClick={() => shareCsv(records, `TILTCHECK_${ship}_${name}_${today()}.csv`)}>
              <IShare />
            </button>
          ) : (
            <span class="icon-btn ghost" />
          )
        }
      />
      {records && <SameSignBanner records={records} />}
      {records && records.some((r) => r.mode === 'line') && records.some((r) => r.mode === 'cap') && (
        <div class="section" style={{ marginBottom: '12px' }}>
          <Seg<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { v: 'all', label: '전체' },
              { v: 'cap', label: '지주캡' },
              { v: 'line', label: '일반 부재' },
            ]}
          />
        </div>
      )}
      {records && records.length === 0 && <Empty icon={ITabRecord} title="이 블록 기록이 없어요" />}
      {[...byDay.entries()].map(([day, list]) => (
        <div style={{ marginBottom: '8px' }}>
          <div class="section-title">
            <span class="num">{day}</span>
            <span>{list.length}건</span>
          </div>
          <div class="list">
            {list.map((r) => (
              <button class="row" onClick={() => setOpen(r)}>
                <div class={'lead' + (r.mode === 'cap' ? ' blue' : '')}>{r.mode === 'cap' ? (r.capNo ?? '').slice(0, 3) : '부재'}</div>
                <div class="body">
                  <div class="t1">{r.mode === 'cap' ? `캡 ${r.capNo}` : r.lineLabel}</div>
                  <div class="t2 num">
                    {fmtDate(r.createdAt).slice(11)} · {summary(r, s.decimals)}
                  </div>
                </div>
                <div class="tail">
                  <span class={'badge ' + verdictLevel(r.verdict)}>{r.verdict}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

      <RecordSheet record={open} onClose={() => setOpen(null)} onDelete={() => setConfirmDel(true)} />
      <ConfirmSheet
        open={confirmDel}
        title="이 기록을 지울까요?"
        sub="지운 기록은 되돌릴 수 없어요."
        okLabel="지우기"
        danger
        onClose={() => setConfirmDel(false)}
        onOk={async () => {
          if (open) await deleteRecord(open.id);
          setConfirmDel(false);
          setOpen(null);
          toast('기록을 지웠어요');
          load();
        }}
      />
    </div>
  );
}

function RecordSheet(p: { record: MeasureRecord | null; onClose: () => void; onDelete: () => void }) {
  const r = p.record;
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!r?.photo) return setUrl(null);
    const u = URL.createObjectURL(r.photo);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [r]);
  if (!r) return null;
  const kv = (k: string, v: string) => (
    <div class="kv">
      <span class="k">{k}</span>
      <span class="v num">{v}</span>
    </div>
  );
  const f = (n: number | null | undefined) => (n == null ? '—' : fmtSigned(n, 2) + '°');
  return (
    <Sheet open={!!r} onClose={p.onClose}>
      <h2>{r.mode === 'cap' ? `캡 ${r.capNo}` : r.lineLabel}</h2>
      <p class="sub num">
        {r.ship} 호선 · {r.block} · {fmtDate(r.createdAt)} · <span class={'c-' + verdictLevel(r.verdict)}>{r.verdict}</span>
      </p>
      {r.mode === 'cap' ? (
        <>
          <div class="kv-group">
            {kv('δ (도면)', `${fmt(r.delta, 2)}° ${r.dir === 1 ? '선수' : '선미'}`)}
            {kv('실제 δ', r.deltaReal == null ? '—' : fmt(r.deltaReal, 2) + '°')}
            {kv('회전오차', f(r.rotErr))}
          </div>
          <div class="kv-group">
            {kv('B 실측 / 정상', `${f(r.measB)} / ${f(r.normalB)}`)}
            {kv('A 실측 / 정상', `${f(r.measA)} / ${f(r.normalA)}`)}
            {kv('A 잔차', f(r.aResid))}
          </div>
        </>
      ) : (
        <div class="kv-group">
          {kv('정상값', fmt(r.normal, 2) + '°')}
          {kv('실측값', fmt(Math.abs(r.meas ?? NaN), 2) + '°')}
          {kv('편차', f(r.dev))}
        </div>
      )}
      {r.memo && (
        <div class="kv-group">
          <div class="kv">
            <span class="k">메모</span>
            <span class="v" style={{ fontWeight: 500, textAlign: 'right', marginLeft: '16px' }}>
              {r.memo}
            </span>
          </div>
        </div>
      )}
      {url && <img class="photo-thumb mt8" src={url} alt="첨부 사진" />}
      <div class="actions mt16">
        <button class="btn grey" onClick={p.onDelete}>
          지우기
        </button>
        <button class="btn" onClick={p.onClose}>
          닫기
        </button>
      </div>
    </Sheet>
  );
}
