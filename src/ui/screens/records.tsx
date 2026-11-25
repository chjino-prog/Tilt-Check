// 기록 : 블록별 목록 → 블록 기록 (경고 배너 · CSV 내보내기 · 상세/삭제)
import { useEffect, useMemo, useState } from 'preact/hooks';
import { bText, dirName, leanText, rotText } from '../../calc/sign';
import { capDirText, fmt, fmtDate, fmtSigned, isLegacyCap, sameSignWarning, verdictLevel } from '../../calc/judge';
import { canShareFile, downloadCsv, shareCsv } from '../../calc/csv';
import { CALC_REV, calcRevName, recalcCapRecord } from '../../calc/capcalc';
import { deleteRecord, getBlock, getCap, listBlocks, listRecords, listRecordsByBlock, saveRecord, type Block, type Cap, type MeasureRecord } from '../../db/store';
import { useSettings } from '../../settings';
import { go } from '../router';
import { BrandBar, ConfirmSheet, Cta, Empty, Headline, MenuRow, Seg, Sheet, TopBar, toast } from '../components/ui';
import { IChevron, IDownload, IInfo, IShare, ITabRecord, IWarn } from '../icons';
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
    // 1.7.0 : 판정 기준인 A · B 편차를 앞에, 역산 회전은 뒤에 참고로
    const rot = r.rotErr == null ? '역산 불가' : `회전 ${fmtSigned(r.rotErr, 2)}°`;
    return `B ${fmtSigned(r.errB, 2)}° · A ${fmtSigned(r.errA, 2)}° · ${rot}`;
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

      <RecordSheet
        record={open}
        onClose={() => setOpen(null)}
        onDelete={() => setConfirmDel(true)}
        onRecalc={(next) => {
          setOpen(next);
          load();
        }}
      />
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

function RecordSheet(p: { record: MeasureRecord | null; onClose: () => void; onDelete: () => void; onRecalc: (next: MeasureRecord) => void }) {
  const r = p.record;
  const s = useSettings();
  const [url, setUrl] = useState<string | null>(null);
  const [ctx, setCtx] = useState<{ cap?: Cap; block?: Block } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!r?.photo) return setUrl(null);
    const u = URL.createObjectURL(r.photo);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [r]);
  // 다시 계산할 때 쓸 지금 캡(외판 기울기) · 블록(턴오버)
  useEffect(() => {
    setCtx(null);
    if (!r || r.mode !== 'cap') return;
    let alive = true;
    Promise.all([r.capId ? getCap(r.capId) : Promise.resolve(undefined), getBlock(r.blockId)]).then(([cap, block]) => alive && setCtx({ cap, block }));
    return () => void (alive = false);
  }, [r?.id, r?.recalcAt]);
  if (!r) return null;
  const re = ctx ? recalcCapRecord(r, ctx.cap, ctx.block, s) : null;
  const offer = re && re.changed && !re.suspect ? re.next : null;
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
      {offer && (
        <div class="banner info">
          <IInfo />
          <div>
            <b>새 계산으로 다시 계산할 수 있어요</b>
            <span class="muted num">
              {[
                ctx?.cap?.shell != null && Math.abs(r.delta ?? 0) >= 1e-9 ? `외판 ${fmt(ctx.cap.shell, 1)}°` : null,
                ctx?.block?.capUp ? '턴오버 후' : null,
                r.basis !== 'ref' && !r.calcRev ? '도면 T.A 경사' : null,
                (r.calcRev ?? 0) < CALC_REV ? '1.7.0 판정(A · B 비교)' : null,
              ]
                .filter(Boolean)
                .join(' · ')}{' '}
              반영 → {offer.verdict} · B 편차 {f(offer.errB)} (지금 {r.verdict}). 잰 값은 그대로예요
            </span>
            <div>
              <button
                class="btn small dark mt8"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await saveRecord(offer);
                  setBusy(false);
                  toast('새 계산으로 다시 계산했어요');
                  p.onRecalc(offer);
                }}
              >
                다시 계산해서 저장
              </button>
            </div>
          </div>
        </div>
      )}
      {re?.suspect && re.changed && (
        <div class="banner">
          <IWarn />
          <div>
            <b>지금 조건으로는 방향이 반대로 보여요</b>
            <span class="muted">블록의 '잴 때 지주캡이 보는 쪽' · FRAME 누운 쪽 · 캡 방향을 확인해주세요</span>
          </div>
        </div>
      )}
      {r.mode === 'cap' ? (
        <>
          {r.caution && (
            <div class="banner">
              <IWarn />
              <div>
                <b>주의 사유</b>
                <span class="muted">{r.caution}</span>
              </div>
            </div>
          )}
          <div class="kv-group">
            {kv('B 실측', isLegacyCap(r) ? `${fmtSigned(r.measB, 2)}° (높은 쪽 기록 없음)` : bText(r.measB, r.faDir ?? 1))}
            {kv('B 정상', isLegacyCap(r) ? `${fmtSigned(r.normalB, 2)}°` : bText(r.normalB, r.faDir ?? 1))}
            {kv('B 편차', f(r.errB))}
            {kv('A 실측 / 정상', `${fmt(r.measA, 2)}° / ${fmt(r.normalA, 2)}°`)}
            {kv('A 편차', f(r.errA))}
            {r.tol != null && kv('합격 허용오차', `±${fmt(r.tol, 1)}° (그때 설정)`)}
          </div>
          <div class="kv-group">
            {kv('역산 회전 (참고)', isLegacyCap(r) ? f(r.rotErr) : r.rotErr == null ? '역산 불가' : `${f(r.rotErr)} · ${rotText(r.rotErr, r.delta ?? 0, r.dir ?? 1)}`)}
            {kv('실제 δ (참고)', r.deltaReal == null ? '—' : fmt(r.deltaReal, 2) + '°' + (r.shell != null && r.deltaRealCap != null ? ` (상판 ${fmt(r.deltaRealCap, 2)}°)` : ''))}
            {kv('A 잔차 (참고)', f(r.aResid))}
            {r.rotScale != null && kv('회전 환산 배율', `B 1° → 회전 ${fmt(r.rotScale, 1)}°`)}
          </div>
          <div class="kv-group">
            {kv('δ (도면)', `${fmt(r.delta, 2)}° ${capDirText(r.delta, r.dir)}`.trim())}
            {r.shell != null && kv('캡 자리 외판', `${fmt(r.shell, 1)}° → 상판 δ ${fmt(r.deltaCap, 2)}°`)}
            {r.calcRev != null && kv('캡 자세', r.up ? '하늘 (턴오버 후)' : '바닥')}
            {kv('F.A', isLegacyCap(r) ? `${fmt(r.fa, 2)}° (방향 기록 없음)` : `${fmt(r.fa, 2)}° · ${leanText(r.faDir ?? 1)}`)}
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
        {kv(
          '계산 기준',
          `${r.basis === 'ref' ? '현물' : '도면'} · T.A ${r.taDesign != null && Math.abs(r.taDesign - r.ta) >= 0.005 ? `${fmt(r.taDesign, 2)}°(경사 ${fmt(r.ta, 2)}°)` : fmt(r.ta, 2) + '°'} · F.A ${fmt(r.fa, 2)}°`,
        )}
        {r.mode === 'cap' &&
          !isLegacyCap(r) &&
          kv('계산 방식', r.calcRev ? `${calcRevName(r.calcRev)}${r.recalcAt ? ` · ${fmtDate(r.recalcAt).slice(5)} 다시 계산` : ''}` : '1.6.0 전 (외판 · 턴오버 반영 안 됨)')}
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
