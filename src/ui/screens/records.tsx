// 기록 : 블록별 목록 → 블록 기록 (경고 배너 · CSV 내보내기 · 상세/삭제)
import { useEffect, useMemo, useState } from 'preact/hooks';
import { bText, dirName, leanText, rotText } from '../../calc/sign';
import { capDirText, fmt, fmtDate, fmtSigned, isLegacyCap, sameSignWarning, verdictLevel } from '../../calc/judge';
import { canShareFile, downloadCsv, shareCsv } from '../../calc/csv';
import { deleteRecord, getBlock, listBlocks, listRecords, listRecordsByBlock, type Block, type MeasureRecord } from '../../db/store';
import { useSettings } from '../../settings';
import { go } from '../router';
import { BrandBar, ConfirmSheet, Cta, Empty, Headline, MenuRow, Seg, Sheet, TopBar, toast } from '../components/ui';
import { IChevron, IDownload, IShare, ITabRecord, IWarn } from '../icons';
import { SameSignBanner } from './block';

const today = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

/** CSV 내보내기 : 다운로드 폴더에 저장(회사 PC 로 옮기기 쉬움) / 다른 앱으로 보내기 */
function ExportSheet(p: { open: boolean; records: MeasureRecord[]; name: string; onClose: () => void }) {
  return (
    <Sheet open={p.open} onClose={p.onClose}>
      <h2>CSV 내보내기</h2>
      <p class="sub">{p.records.length}건 · {p.name}</p>
      <MenuRow
        icon={IDownload}
        label="다운로드 폴더에 저장"
        onClick={() => {
          downloadCsv(p.records, p.name);
          p.onClose();
          toast('다운로드 폴더에 저장했어요');
        }}
      />
      {canShareFile() && (
        <MenuRow
          icon={IShare}
          label="다른 앱으로 보내기"
          onClick={() => {
            p.onClose();
            shareCsv(p.records, p.name);
          }}
        />
      )}
      <p class="note">다운로드 폴더는 폰 '내 파일 › 다운로드' 에 있어요. USB 로 PC 에 연결해 옮기면 돼요</p>
    </Sheet>
  );
}

export function RecordsScreen() {
  const [records, setRecords] = useState<MeasureRecord[] | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [exporting, setExporting] = useState(false);
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
            <button class="icon-btn" aria-label="전체 CSV 내보내기" onClick={() => setExporting(true)}>
              <IShare />
            </button>
          ) : undefined
        }
      />
      <Headline title="기록" sub={records && !empty ? `${records.length}건 · 블록별로 모아 봐요` : undefined} />
      {records && <ExportSheet open={exporting} records={records} name={`TILTCHECK_전체_${today()}.csv`} onClose={() => setExporting(false)} />}
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
    if (isLegacyCap(r)) return `1.2.0 전 계산 방식 · 회전오차 ${fmtSigned(r.rotErr, 2)}°`;
    if (r.rotErr == null) return `B ${bText(r.measB, r.faDir ?? 1)} · 역산 불가`;
    return `${rotText(r.rotErr, r.delta ?? 0, r.dir ?? 1)} · A잔차 ${fmtSigned(r.aResid, 2)}°`;
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
  const [exporting, setExporting] = useState(false);

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

  const hasCap = !!records?.some((r) => r.mode === 'cap');

  return (
    <div class={'screen' + (hasCap ? '' : ' no-cta')}>
      <TopBar
        title={name ? `${name} 기록` : '기록'}
        backTo="/records"
        right={
          records && records.length > 0 ? (
            <button class="icon-btn" aria-label="CSV 내보내기" onClick={() => setExporting(true)}>
              <IShare />
            </button>
          ) : (
            <span class="icon-btn ghost" />
          )
        }
      />
      {records && <ExportSheet open={exporting} records={records} name={`TILTCHECK_${ship}_${name}_${today()}.csv`} onClose={() => setExporting(false)} />}
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

      {hasCap && (
        <Cta>
          <button class="btn" onClick={() => go(`/records/${p.blockId}/report`)}>
            보고서 만들기
          </button>
        </Cta>
      )}

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
      {isLegacyCap(r) && (
        <div class="banner">
          <IWarn />
          <div>
            <b>1.2.0 전 계산 방식의 기록이에요</b>
            <span class="muted">F.A 방향 · B 높은 쪽 없이 계산돼, F.A 선미 블록이면 회전오차가 크게 틀릴 수 있어요. 같은 방향 경고 계산에서는 빼요</span>
          </div>
        </div>
      )}
      {r.mode === 'cap' ? (
        <>
          <div class="kv-group">
            {kv('δ (도면)', `${fmt(r.delta, 2)}° ${capDirText(r.delta, r.dir)}`.trim())}
            {kv('실제 δ', r.deltaReal == null ? '—' : fmt(r.deltaReal, 2) + '°')}
            {kv('회전오차', isLegacyCap(r) ? f(r.rotErr) : `${f(r.rotErr)} · ${rotText(r.rotErr, r.delta ?? 0, r.dir ?? 1)}`)}
          </div>
          <div class="kv-group">
            {kv('F.A', isLegacyCap(r) ? `${fmt(r.fa, 2)}° (방향 기록 없음)` : `${fmt(r.fa, 2)}° · ${leanText(r.faDir ?? 1)}`)}
            {kv('B 실측', isLegacyCap(r) ? `${fmtSigned(r.measB, 2)}° (높은 쪽 기록 없음)` : bText(r.measB, r.faDir ?? 1))}
            {kv('B 정상', isLegacyCap(r) ? `${fmtSigned(r.normalB, 2)}°` : bText(r.normalB, r.faDir ?? 1))}
            {kv('A 실측 / 정상', `${fmt(r.measA, 2)}° / ${fmt(r.normalA, 2)}°`)}
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
      <div class="kv-group">
        {kv('계산 기준', `${r.basis === 'ref' ? '현물' : '도면'} · T.A ${fmt(r.ta, 2)}° · F.A ${fmt(r.fa, 2)}°`)}
      </div>
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
