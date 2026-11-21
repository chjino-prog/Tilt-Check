// 블록 상세 : 설계값 · 지주캡 목록 · 일반 부재(추가 기능)
import { useEffect, useState } from 'preact/hooks';
import { blockAnglesLookRight } from '../../calc/angle';
import { effectiveAngles, hasDesign, hasRef, type Basis } from '../../calc/basis';
import { capDirText, fmt, fmtDate, fmtSigned, latestPerCap, sameSignWarning, verdictLevel } from '../../calc/judge';
import { dirName } from '../../calc/sign';
import { deleteBlock, duplicateBlock, getBlock, listCaps, listRecordsByBlock, saveBlock, type Block, type Cap, type MeasureRecord } from '../../db/store';
import { go } from '../router';
import { ConfirmSheet, Cta, Headline, MenuRow, Seg, Sheet, TopBar, toast } from '../components/ui';
import { IChevron, ICopy, IEdit, IRuler, ITabRecord, ITrash, IWarn } from '../icons';
import { BlockSheet, CapSheet } from './edit-sheets';

export function SameSignBanner(p: { records: MeasureRecord[] }) {
  const w = sameSignWarning(p.records);
  if (!w.warn) return null;
  return (
    <div class="banner">
      <IWarn />
      <div>
        <b>
          캡 {w.count}개의 회전오차가 모두 {w.sign > 0 ? '+' : '−'} 쪽이에요
        </b>
        <span class="muted">마킹 기준 · 방향(선수/선미) · 블록 세팅을 확인해주세요</span>
      </div>
    </div>
  );
}

export function BlockScreen(p: { id: string }) {
  const [block, setBlock] = useState<Block | null | undefined>(undefined);
  const [caps, setCaps] = useState<Cap[]>([]);
  const [records, setRecords] = useState<MeasureRecord[]>([]);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addingCap, setAddingCap] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const load = async () => {
    const [b, cs, rs] = await Promise.all([getBlock(p.id), listCaps(p.id), listRecordsByBlock(p.id)]);
    setBlock(b ?? null);
    setCaps(cs.sort((a, b) => a.no.localeCompare(b.no, 'ko', { numeric: true })));
    setRecords(rs);
  };
  useEffect(() => {
    load();
  }, [p.id]);

  if (block === undefined) return <div class="screen" />;
  if (block === null)
    return (
      <div class="screen">
        <TopBar />
        <Headline title="블록을 찾을 수 없어요" sub="지워졌을 수 있어요" />
      </div>
    );

  const latest = latestPerCap(records);
  const eff = effectiveAngles(block);
  const design = hasDesign(block);
  const ref = hasRef(block);
  const odd = eff != null && !blockAnglesLookRight(eff.ta, eff.fa);
  const setBasis = async (b: Basis) => {
    const nb = { ...block, basis: b, updatedAt: Date.now() };
    await saveBlock(nb);
    setBlock(nb);
  };
  const goRef = () => go(`/block/${block.id}/ref`);
  const faName = eff ? (eff.faDirSet ? `FRAME ANGLE · ${dirName(eff.faDir)}` : 'FRAME ANGLE · 방향 미정') : '';
  /** 지금 기준 값 + 아래에 다른 쪽 값 */
  const angleRow = (key: string, name: string, v: number, other: number | null, otherName: string) => (
    <div class="angle-row">
      <span class="k">
        <b>{key}</b> {name}
      </span>
      <span class="v num">
        {fmt(v, 3)}
        <small>°</small>
        {other != null && (
          <span class="other">
            {otherName} {fmt(other, 3)}
          </span>
        )}
      </span>
    </div>
  );

  return (
    <div class="screen">
      <TopBar onMore={() => setMenu(true)} />
      <Headline eyebrow={`${block.ship} 호선`} title={block.block} sub={block.memo || undefined} />

      <div class="section">
        {eff == null ? (
          <div class="card card-empty">
            <div class="t">T.A · F.A 를 현물에서 재요</div>
            <div class="s">CAMBER · SHEER 없는 DECK 상면 두 곳에 폰을 대면 돼요</div>
            <button class="btn small" onClick={goRef}>
              현물에서 재기
            </button>
          </div>
        ) : (
          <div class="card">
            {design && ref && (
              <Seg<Basis>
                value={eff.basis}
                onChange={setBasis}
                options={[
                  { v: 'design', label: '도면값' },
                  { v: 'ref', label: '현물값' },
                ]}
              />
            )}
            {eff.basis === 'ref'
              ? [
                  angleRow('T.A', 'TRANSVERSE ANGLE', eff.ta, block.ta, '도면'),
                  angleRow('F.A', faName, eff.fa, block.fa, '도면'),
                ]
              : [
                  angleRow('T.A', 'TRANSVERSE ANGLE', eff.ta, ref ? block.refTa! : null, '현물'),
                  angleRow('F.A', faName, eff.fa, ref ? block.refFa! : null, '현물'),
                ]}
            {odd && <div class="note c-warn">0 &lt; F.A ≤ T.A &lt; 90° 가 아니에요. 정의를 확인해주세요.</div>}
            <div class="card-foot">
              <span class="num">{ref ? `현물값 ${fmtDate(block.refAt ?? block.updatedAt).slice(5)} 에 잼` : '도면값으로 계산해요'}</span>
              <button class="text-btn" onClick={goRef}>
                {ref ? '다시 재기' : '현물에서 재기'}
              </button>
            </div>
          </div>
        )}
      </div>

      <SameSignBanner records={records} />

      <div class="section-title">
        <span>지주캡 {caps.length}개</span>
      </div>
      {caps.length === 0 ? (
        <div class="section">
          <div class="note" style={{ marginTop: 0 }}>
            지주캡을 추가하면 정상 각도를 계산하고 바로 잴 수 있어요
          </div>
        </div>
      ) : (
        <div class="list">
          {caps.map((c) => {
            const r = latest.get(c.id);
            return (
              <button class="row" onClick={() => go(`/block/${block.id}/cap/${c.id}`)}>
                <div class="lead blue num">{c.no.length <= 3 ? c.no : c.no.slice(0, 3)}</div>
                <div class="body">
                  <div class="t1">캡 {c.no}</div>
                  <div class="t2 num">
                    δ {Number(c.delta.toFixed(3))}° {capDirText(c.delta, c.dir)}
                    {r?.rotErr != null && ` · 회전 ${fmtSigned(r.rotErr, 2)}°`}
                  </div>
                </div>
                <div class="tail">
                  {r?.basis === 'ref' && <span class="badge blue">현물</span>}
                  {r ? <span class={'badge ' + verdictLevel(r.verdict)}>{r.verdict}</span> : <span class="badge">미측정</span>}
                  <span class="chev">
                    <IChevron />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div class="divider" />
      <div class="section-title">
        <span>더 보기</span>
      </div>
      <div class="list">
        <button class="row" onClick={() => go(`/block/${block.id}/line`)}>
          <div class="lead">
            <IRuler />
          </div>
          <div class="body">
            <div class="t1">다른 부재 각도 재기</div>
            <div class="t2">FRAME · LONGL. · 임의 방향 라인</div>
          </div>
          <span class="chev">
            <IChevron />
          </span>
        </button>
        <button class="row" onClick={() => go(`/records/${block.id}`)}>
          <div class="lead">
            <ITabRecord />
          </div>
          <div class="body">
            <div class="t1">이 블록 기록</div>
            <div class="t2">{records.length}건</div>
          </div>
          <span class="chev">
            <IChevron />
          </span>
        </button>
      </div>

      <Cta>
        <button class="btn" onClick={() => setAddingCap(true)}>
          지주캡 추가
        </button>
      </Cta>

      <Sheet open={menu} onClose={() => setMenu(false)}>
        <MenuRow icon={IEdit} label="블록 수정" onClick={() => (setMenu(false), setEditing(true))} />
        <MenuRow
          icon={ICopy}
          label="블록 복제 (지주캡 포함)"
          onClick={async () => {
            setMenu(false);
            const c = await duplicateBlock(block.id);
            if (c) {
              toast('블록을 복제했어요');
              go('/block/' + c.id, true);
            }
          }}
        />
        <MenuRow icon={ITrash} label="블록 삭제" danger onClick={() => (setMenu(false), setConfirmDel(true))} />
      </Sheet>
      <BlockSheet
        open={editing}
        block={block}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          load();
        }}
      />
      <CapSheet
        open={addingCap}
        blockId={block.id}
        onClose={() => setAddingCap(false)}
        onSaved={() => {
          setAddingCap(false);
          load();
        }}
      />
      <ConfirmSheet
        open={confirmDel}
        title={`${block.block} 블록을 지울까요?`}
        sub={`지주캡 ${caps.length}개와 기록 ${records.length}건도 함께 지워지고, 되돌릴 수 없어요.`}
        okLabel="지우기"
        danger
        onClose={() => setConfirmDel(false)}
        onOk={async () => {
          await deleteBlock(block.id);
          toast('블록을 지웠어요');
          go('/', true);
        }}
      />
    </div>
  );
}
