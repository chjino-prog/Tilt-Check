// 현물 기준 재기 : DECK 상면 FRAME 라인(T.A) · LONGL. 라인(F.A) → 확인 후 블록에 저장
// 잰 값은 하나씩 바로 저장(중간 저장) — 한쪽만 재고 나가도 남는다. F.A 는 숫자 + 높은 쪽.
import { useEffect, useState } from 'preact/hooks';
import { blockAnglesLookRight, type Dir } from '../../calc/angle';
import { hasDesign, refFromMeasure } from '../../calc/basis';
import { devLevel, fmt, fmtSigned } from '../../calc/judge';
import { dirName } from '../../calc/sign';
import { clearDraft, loadDraft, saveDraft, type Draft, type Reading } from '../../db/draft';
import { getBlock, saveBlock, type Block } from '../../db/store';
import { useSettings } from '../../settings';
import { useWakeLock } from '../../sensor/tilt';
import { back } from '../router';
import { Cta, Headline, RefNote, RefWarningSheet, Sheet, TopBar, toast } from '../components/ui';
import { HeadCard, HighPicker, ReadingCard, useHead, useHighSide, useMeasure } from '../components/reading';
import { IBack, ICheck, IChevron, IInfo, IWarn } from '../icons';

type Stage = 'hub' | 'ta' | 'fa' | 'done';

/** 기준 부재 고르는 법 */
export function RefGuideSheet(p: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={p.open} onClose={p.onClose}>
      <h2>기준 부재는 이렇게 골라요</h2>
      <p class="sub">기준이 틀리면 이 블록의 모든 캡 판정이 같이 틀어져요</p>
      <div class="where">
        <div class="where-h">
          <b>T.A</b> FRAME 라인
        </div>
        <div class="li ok">DECK 상면, CAMBER 없는 구간의 FRAME 방향</div>
        <div class="li ok">숫자만 재요. 어느 쪽으로 대도 돼요</div>
      </div>
      <div class="where">
        <div class="where-h">
          <b>F.A</b> LONGL. 라인
        </div>
        <div class="li ok">CENTER LINE 과 평행한 LONGL. 라인만</div>
        <div class="li ok">GIRDER 류 강력부재 위에서 재요</div>
        <div class="li ok">숫자와 함께 높은 쪽(선수/선미)을 골라요</div>
        <div class="li no">경사 부재는 재면 안 돼요</div>
        <div class="li no">ANGLE 부재는 변형되기 쉬워 되도록 피해요</div>
      </div>
      <div class="actions mt16">
        <button class="btn" onClick={p.onClose}>
          확인
        </button>
      </div>
    </Sheet>
  );
}

export function RefScreen(p: { blockId: string }) {
  const [block, setBlock] = useState<Block | null | undefined>(undefined);
  const [draft, setDraftState] = useState<Draft>(() => loadDraft('ref', p.blockId));
  // 전에 잰 값이 있으면 순서 화면부터, 없으면 바로 T.A 재기
  const [stage, setStage] = useState<Stage>(() => {
    const d = loadDraft('ref', p.blockId);
    return d.first || d.second ? 'hub' : 'ta';
  });
  const [guide, setGuide] = useState(false);

  useEffect(() => {
    getBlock(p.blockId).then((b) => setBlock(b ?? null));
  }, [p.blockId]);

  if (block === undefined) return <div class="screen" />;
  if (!block)
    return (
      <div class="screen">
        <TopBar />
        <Headline title="블록을 찾을 수 없어요" />
      </div>
    );

  const putDraft = (d: Draft) => {
    setDraftState(d);
    saveDraft('ref', block.id, d);
  };
  const rTa = draft.first;
  const rFa = draft.second;
  const nextAfter = (d: Draft): Stage => (!d.first ? 'ta' : !d.second ? 'fa' : 'done');

  const stepBack = () => {
    if (stage === 'hub' || (stage === 'ta' && !rTa && !rFa)) back('/block/' + block.id);
    else setStage('hub'); // 잰 값은 그대로 두고 순서 화면으로
  };
  const bar = (
    <header class="topbar">
      <button class="icon-btn" aria-label="뒤로" onClick={stepBack}>
        <IBack />
      </button>
      <div class="title">현물 기준</div>
      <span class="icon-btn ghost" />
    </header>
  );
  const sheet = <RefGuideSheet open={guide} onClose={() => setGuide(false)} />;

  if (stage === 'hub') {
    const row = (key: Stage, n: string, name: string, where: string, r: Reading | undefined, side?: string) => (
      <button class="row" onClick={() => setStage(key)}>
        <div class={'lead ' + (r ? 'done' : 'blue')}>{r ? <ICheck /> : n}</div>
        <div class="body">
          <div class="t1">{name}</div>
          <div class="t2">{where}</div>
        </div>
        {r ? (
          <div class="saved num">
            <b>{fmt(r.v, 2)}°</b>
            {side && <span>{side}</span>}
          </div>
        ) : (
          <span class="chev">
            <IChevron />
          </span>
        )}
      </button>
    );
    const next = nextAfter(draft);
    return (
      <div class="screen">
        {bar}
        <Headline eyebrow={`${block.ship} 호선 · ${block.block}`} title="기준 부재 두 곳을 재요" sub="잰 값은 바로 저장돼요. 하나씩 재도 돼요" />
        <div class="list">
          {row('ta', '1', 'T.A · FRAME 라인', 'DECK 상면, CAMBER 없는 곳', rTa)}
          {row('fa', '2', 'F.A · LONGL. 라인', 'CENTER LINE 과 평행한 GIRDER 위', rFa, rFa ? (rFa.high ? dirName(rFa.high) + ' 높음' : '수평') : undefined)}
        </div>
        {(rTa || rFa) && (
          <div class="section mt16">
            <button
              class="text-btn grey"
              onClick={() => {
                clearDraft('ref', block.id);
                setDraftState({});
              }}
            >
              잰 값 지우기
            </button>
          </div>
        )}
        <Cta>
          <button class="btn" onClick={() => setStage(next)}>
            {next === 'ta' ? 'T.A 재기' : next === 'fa' ? 'F.A 재기' : '확인하기'}
          </button>
        </Cta>
        {sheet}
      </div>
    );
  }

  if (stage === 'ta' || stage === 'fa') {
    const isTa = stage === 'ta';
    return (
      <RefStep
        key={stage}
        bar={bar}
        isTa={isTa}
        done={{ ta: !!rTa, fa: !!rFa }}
        title={isTa ? 'DECK 상면 FRAME 라인에 폰을 대주세요' : 'DECK 상면 LONGL. 라인에 폰을 대주세요'}
        sub={isTa ? 'CAMBER 없는 곳 · 어느 쪽으로 대도 돼요' : 'CENTER LINE 과 평행한 GIRDER 위 · SHEER 없는 곳'}
        note={isTa ? '용접 비드 · 덧판을 피해 평평한 곳에 대주세요' : 'ANGLE 부재는 변형되기 쉬워요. 되도록 GIRDER 류 강력부재에 대주세요'}
        design={hasDesign(block) ? (isTa ? block.ta : block.fa) : null}
        designLabel={isTa ? '도면 T.A' : `도면 F.A${block.faDir ? ' ' + dirName(block.faDir) : ''}`}
        onGuide={() => setGuide(true)}
        onDone={(r) => {
          const d = isTa ? { ...draft, first: r } : { ...draft, second: r };
          putDraft(d);
          setStage(nextAfter(d));
        }}
      >
        {sheet}
      </RefStep>
    );
  }

  if (!rTa || !rFa) {
    setStage('hub');
    return <div class="screen" />;
  }

  return <RefResult bar={bar} block={block} rTa={rTa} rFa={rFa} onRetry={() => setStage('hub')} onSaved={() => clearDraft('ref', block.id)} />;
}

function RefStep(p: {
  bar: preact.JSX.Element;
  isTa: boolean;
  done: { ta: boolean; fa: boolean };
  title: string;
  sub: string;
  note: string;
  design: number | null;
  designLabel: string;
  onGuide: () => void;
  onDone: (r: Reading) => void;
  children: preact.ComponentChildren;
}) {
  const head = useHead();
  // F.A 를 센서로 잴 때는 폰 머리 방향을 확인해야 고정할 수 있다 (틀리면 블록 F.A 방향이 뒤집힘)
  const m = useMeasure(!p.isTa && !head.ok ? '먼저 폰 머리 방향을 확인해주세요' : null);
  const h = useHighSide(m, head);
  useWakeLock();
  const needHead = !p.isTa && !m.manual && m.sensor.status === 'running' && !head.ok;
  const canHold = m.sensor.status === 'running' && !m.manual && !needHead;
  const v = m.value;
  const summary = p.isTa || v == null ? null : h.flat ? '수평 (F.A 0°)' : h.high ? `${dirName(h.high)} 쪽이 ${fmt(Math.abs(v), 2)}° 높음` : null;
  const faSub = !p.isTa && h.high ? `→ F.A ${dirName(-h.high as Dir)} ${fmt(Math.abs(v!), 2)}°` : null;
  const ready = m.fixed != null && (p.isTa || h.ready);
  const otherDone = p.isTa ? p.done.fa : p.done.ta;
  return (
    <div class="screen">
      {p.bar}
      <div class="steps">
        <span class={p.isTa || p.done.ta ? 'on' : ''} />
        <span class={!p.isTa || p.done.fa ? 'on' : ''} />
      </div>
      <Headline eyebrow={p.isTa ? '1/2 · T.A' : '2/2 · F.A'} title={!p.isTa && !m.manual && m.sensor.status === 'running' ? `폰 머리를 ${dirName(head.dir)} 쪽으로 대주세요` : p.title} sub={p.sub} />
      <div class="section" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span class="normal-pill num">
          {p.design != null ? (
            <>
              {p.designLabel} <b>{fmt(p.design, 2)}°</b>
            </>
          ) : (
            '도면값 없이 재요'
          )}
        </span>
        <button class="text-btn" onClick={p.onGuide}>
          어디에 대요?
        </button>
      </div>
      {/* 도면값이 있으면 도면 대비 차이를 보여주고, 없으면 값만 */}
      {!p.isTa && <HeadCard m={m} head={head} />}
      <ReadingCard m={m} normal={p.design} compareAbs={true} normalLabel="도면 대비" unsigned />
      {!p.isTa && <HighPicker m={m} h={h} head={head} summary={summary} sub={faSub} />}
      <RefNote />
      <div class="disclaimer">{p.note}</div>
      <RefWarningSheet />
      <Cta>
        {m.fixed == null ? (
          <button class="btn" disabled={m.manual || !canHold} onClick={m.hold}>
            {m.manual ? '값을 입력해주세요' : needHead ? '폰 머리 방향을 먼저 확인해주세요' : '고정하기'}
          </button>
        ) : (
          <>
            {!m.manual && (
              <button class="btn grey" onClick={m.release}>
                다시
              </button>
            )}
            <button
              class="btn"
              disabled={!ready}
              onClick={() =>
                p.onDone({
                  v: Math.abs(m.fixed!),
                  high: !p.isTa && !h.flat ? h.high ?? undefined : undefined,
                  at: Date.now(),
                  manual: m.manual || undefined,
                })
              }
            >
              {!ready ? '높은 쪽을 골라주세요' : otherDone ? '저장하고 확인' : p.isTa ? '저장하고 F.A 재기' : '저장하고 T.A 재기'}
            </button>
          </>
        )}
      </Cta>
      {p.children}
    </div>
  );
}

function RefResult(p: { bar: preact.JSX.Element; block: Block; rTa: Reading; rFa: Reading; onRetry: () => void; onSaved: () => void }) {
  const s = useSettings();
  const { block } = p;
  const { refTa, refFa, refFaDir } = refFromMeasure(p.rTa.v, p.rFa.v, p.rFa.high);
  const design = hasDesign(block);
  const dTa = design ? refTa - Math.abs(block.ta!) : null;
  const dFa = design ? refFa - Math.abs(block.fa!) : null;
  const lTa = devLevel(dTa, s);
  const lFa = devLevel(dFa, s);
  const far = lTa === 'bad' || lFa === 'bad';
  const close = lTa === 'good' && lFa === 'good';
  const odd = !blockAnglesLookRight(refTa, refFa);
  // 도면 F.A 방향과 현물 방향이 반대 (둘 다 뚜렷할 때만)
  const dirClash = design && block.faDir != null && refFaDir != null && refFaDir !== block.faDir && refFa > 0.3 && Math.abs(block.fa!) > 0.3;
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await saveBlock({ ...block, refTa, refFa, refFaDir, refAt: Date.now(), basis: 'ref', updatedAt: Date.now() });
    p.onSaved();
    toast('현물 기준으로 계산해요');
    back('/block/' + block.id);
  };

  const card = (k: string, v: number, d: number | null, lvl: string, dv: number | null) => (
    <div class="card">
      <div class="k">
        <b>{k}</b> 현물
      </div>
      <div class="v">
        {fmt(v, 2)}
        <small>°</small>
      </div>
      {d != null && (
        <div class="d">
          도면 {fmt(d, 2)} · <em class={'c-' + lvl}>{fmtSigned(dv, 2)}</em>
        </div>
      )}
    </div>
  );

  return (
    <div class="screen">
      {p.bar}
      <div class="result-hero">
        <div class={'mark ' + (far || dirClash ? 'warn' : 'blue')}>{far || dirClash ? <IWarn /> : <ICheck />}</div>
        <h1>{dirClash ? 'F.A 방향이 도면과 반대예요' : far ? '도면값과 많이 달라요' : '현물 기준을 잡았어요'}</h1>
        <p>{far || dirClash ? '기준 부재 위치와 높은 쪽을 한 번 더 확인해주세요' : '이 블록 측정은 이제 이 값으로 계산해요'}</p>
      </div>
      <div class="section">
        <div class="fa-dir-card">
          <svg viewBox="0 0 96 96" role="img" aria-label={`옆에서 본 LONGL. 라인 : ${p.rFa.high ? dirName(p.rFa.high) + ' 쪽이 높음' : '수평'}`}>
            <text x="6" y="20" class="t on">
              {p.rFa.high === -1 ? '선미' : '선수'}
            </text>
            <text x="62" y="88" class="t">
              {p.rFa.high === -1 ? '선수' : '선미'}
            </text>
            <path d={p.rFa.high ? 'M10 36 L86 66' : 'M10 56 L86 56'} class="line" />
            <path d="M10 66 L86 66" class="base" />
            {p.rFa.high && <path d="M18 30 L18 16 M13 21 L18 15 L23 21" class="arrow" />}
          </svg>
          <div>
            <span>LONGL. 라인 잰 결과</span>
            <b class="num">{p.rFa.high ? `${dirName(p.rFa.high)} 쪽이 ${fmt(refFa, 2)}° 높음` : '수평'}</b>
            <i />
            <span>그래서 저장되는 값</span>
            <strong class="num">{refFaDir ? `F.A ${dirName(refFaDir)} ${fmt(refFa, 2)}°` : `F.A ${fmt(refFa, 2)}°`}</strong>
          </div>
        </div>
      </div>
      {!design && refFa > 0.05 && (
        <div class="alert warn">
          <IWarn />
          <div>
            <b>도면값이 없어 방향을 맞춰볼 수 없어요</b>
            <span>잴 때 폰 머리가 정한 쪽이었는지, 실제로 {p.rFa.high ? dirName(p.rFa.high) : ''} 쪽이 높았는지 눈으로 한 번 더 봐주세요</span>
          </div>
        </div>
      )}
      <div class="section ref-cmp num">
        {card('T.A', refTa, design ? Math.abs(block.ta!) : null, lTa, dTa)}
        {card('F.A ' + (refFaDir ? dirName(refFaDir) : ''), refFa, design ? Math.abs(block.fa!) : null, lFa, dFa)}
      </div>
      {dirClash && (
        <div class="alert bad">
          <IWarn />
          <div>
            <b>
              도면은 F.A {dirName(block.faDir!)}인데, 현물은 {dirName(p.rFa.high!)} 쪽이 높아요
            </b>
            <span class="muted">F.A {dirName(block.faDir!)} 블록은 LONGL. 라인의 {dirName(-block.faDir! as Dir)} 쪽이 높아요. 폰 머리 방향 · 높은 쪽 선택을 확인해주세요</span>
          </div>
        </div>
      )}
      {far && (
        <div class="banner">
          <IWarn />
          <div>
            <b>도면과 {fmt(s.tol2, 1)}° 넘게 차이 나요</b>
            <span class="muted">CAMBER · SHEER 구간이거나, 경사 부재 · CENTER LINE 과 평행하지 않은 라인을 잰 건 아닌지 봐주세요</span>
          </div>
        </div>
      )}
      {!far && !dirClash && close && (
        <div class="banner info">
          <IInfo />
          <div>
            <b>블록 세팅이 도면과 거의 같아요</b>
            <span class="muted">T.A · F.A 둘 다 {fmt(s.tol1, 1)}° 안이에요</span>
          </div>
        </div>
      )}
      {odd && (
        <div class="banner">
          <IWarn />
          <div>
            <b>F.A 가 T.A 보다 커요</b>
            <span class="muted">FRAME · LONGL. 라인을 바꿔 잰 건 아닌지 확인해주세요</span>
          </div>
        </div>
      )}
      <Cta>
        <button class="btn grey" onClick={p.onRetry}>
          다시 재기
        </button>
        <button class="btn" disabled={saving} onClick={save}>
          {p.rFa.high ? `${dirName(p.rFa.high)}가 높았어요 · 저장` : '이 기준 쓰기'}
        </button>
      </Cta>
    </div>
  );
}
