// 현물 기준 재기 : FRAME 수평선(T.A) · FRAME 웹(F.A) → 확인 후 블록에 저장
// 잰 값은 하나씩 바로 저장(중간 저장) — 한쪽만 재고 나가도 남는다.
// F.A 는 기본으로 FRAME 웹에 폰 뒷면을 붙여 '판 기울기'를 잰다. LONGL. 라인(폰 긴 옆면)은 다른 방법으로 남긴다.
// 방향은 'FRAME 이 누운 쪽'으로 받고 보여준다 (= F.A 방향 = LONGL. 라인의 낮은 끝).
import { useEffect, useState } from 'preact/hooks';
import { blockAnglesLookRight, type Dir } from '../../calc/angle';
import { designSlope, hasDesign, refFromMeasure } from '../../calc/basis';
import { devLevel, fmt, fmtSigned } from '../../calc/judge';
import { dirName, leanFromFace, leanOfLonglHigh, leanText, longlHighOfLean } from '../../calc/sign';
import { clearDraft, loadDraft, saveDraft, type Draft, type Reading } from '../../db/draft';
import { getBlock, saveBlock, type Block } from '../../db/store';
import { useSettings } from '../../settings';
import { tilt, useTilt, useWakeLock, vibrate } from '../../sensor/tilt';
import { back, go } from '../router';
import { Cta, Headline, RefNote, RefWarningSheet, Sheet, TopBar, toast } from '../components/ui';
import { HeadCard, HighPicker, ReadingCard, useHead, useHighSide, useMeasure } from '../components/reading';
import { FacingFigure, LeanFigure } from '../components/lean';
import { IBack, ICheck, IChevron, IInfo, IWarn } from '../icons';

type Stage = 'hub' | 'ta' | 'fa' | 'done';
type FaMethod = 'web' | 'line';

/** 저장된 F.A 값 → FRAME 누운 쪽 */
const leanOf = (r: Reading | undefined): Dir | null => (r?.high ? leanOfLonglHigh(r.high) : null);

/** 기준 부재 고르는 법 */
export function RefGuideSheet(p: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={p.open} onClose={p.onClose}>
      <h2>기준 부재는 이렇게 골라요</h2>
      <p class="sub">기준이 틀리면 이 블록의 모든 캡 판정이 같이 틀어져요</p>
      <div class="where">
        <div class="where-h">
          <b>T.A</b> 배 기준 수평인 FRAME 방향 선
        </div>
        <div class="li ok">DECK · FLAT · STRINGER 상면의 FRAME 선 (CAMBER 없는 곳)</div>
        <div class="li ok">DECK 이 없으면 FRAME 웹의 수평 보강재</div>
        <div class="li ok">폰을 세워 긴 옆면을 대요. 숫자만, 어느 쪽으로 대도 돼요</div>
      </div>
      <div class="where">
        <div class="where-h">
          <b>F.A</b> FRAME 웹 (폰 뒷면)
        </div>
        <div class="li ok">선수를 보고 서서, 눈앞 웹에 폰 뒷면을 붙여요</div>
        <div class="li ok">보강재 · 용접 · 구멍을 피한 평평한 곳</div>
        <div class="li ok">폰을 웹 위에서 어떻게 돌려 붙여도 같은 값이에요</div>
      </div>
      <div class="where">
        <div class="where-h">
          <b>F.A</b> 다른 방법 · LONGL. 라인
        </div>
        <div class="li ok">CENTER LINE 과 평행한 GIRDER · 론지 (디지털 수평계도 이 방법)</div>
        <div class="li no">ANGLE 부재 · 경사 부재는 피해요</div>
      </div>
      <div class="where">
        <div class="where-h">
          <b>재면 안 돼요</b>
        </div>
        <div class="li no">BASE 로 깐 판 위 (외판 · HOPPER · L.BHD) — 일부러 평평하게 깔아서 어디를 재도 0° 근처예요</div>
        <div class="li no">FRAME 웹에 폰 긴 옆면을 대기 — 웹 위 선 하나라 대는 방향마다 값이 달라요</div>
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
  const [faMethod, setFaMethod] = useState<FaMethod>(() => loadDraft('ref', p.blockId).second?.method ?? 'web');
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
  const designFa = hasDesign(block) ? block.fa : null;
  const designFaLabel = `도면 F.A${block.faDir ? ' · ' + leanText(block.faDir) : ''}`;
  // 폰은 실제 경사를 재므로 도면 T.A 도 경사로 바꿔 비교한다
  const designTa = hasDesign(block) ? designSlope(block.ta!, block.fa!) : null;
  const designTaLabel = hasDesign(block) && Math.abs(designTa! - Math.abs(block.ta!)) >= 0.005 ? `도면 T.A ${fmt(Math.abs(block.ta!), 2)}° → 경사` : '도면 T.A';

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
    const lean = leanOf(rFa);
    return (
      <div class="screen">
        {bar}
        <Headline eyebrow={`${block.ship} 호선 · ${block.block}`} title="기준 부재 두 곳을 재요" sub="잰 값은 바로 저장돼요. 하나씩 재도 돼요" />
        <div class="list">
          {row('ta', '1', 'T.A · FRAME 방향 수평선', 'DECK · FLAT 상면이나 웹 수평 보강재', rTa)}
          {row('fa', '2', faMethod === 'web' ? 'F.A · FRAME 웹' : 'F.A · LONGL. 라인', faMethod === 'web' ? '폰 뒷면을 웹에 붙여요' : 'CENTER LINE 과 평행한 GIRDER 위', rFa, rFa ? (lean ? leanText(lean) : '수직') : undefined)}
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

  const onDone = (isTa: boolean) => (r: Reading) => {
    const d = isTa ? { ...draft, first: r } : { ...draft, second: r };
    putDraft(d);
    setStage(nextAfter(d));
  };

  if (stage === 'fa' && faMethod === 'web') {
    return (
      <WebStep bar={bar} done={{ ta: !!rTa, fa: !!rFa }} design={designFa} designLabel={designFaLabel} onGuide={() => setGuide(true)} onLine={() => setFaMethod('line')} onDone={onDone(false)}>
        {sheet}
      </WebStep>
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
        title={isTa ? 'FRAME 방향 수평선에 폰을 대주세요' : 'LONGL. 라인에 폰을 대주세요'}
        sub={isTa ? 'DECK · FLAT · STRINGER 상면이나 웹 수평 보강재 · 어느 쪽으로 대도 돼요' : 'CENTER LINE 과 평행한 GIRDER · 론지 위 · SHEER 없는 곳'}
        note={isTa ? '폰을 세워 긴 옆면을 대요. 용접 비드 · 덧판은 피해요' : 'ANGLE 부재는 변형되기 쉬워요. 되도록 GIRDER 류 강력부재에 대주세요'}
        design={isTa ? designTa : designFa}
        designLabel={isTa ? designTaLabel : designFaLabel}
        onGuide={() => setGuide(true)}
        onWeb={isTa ? undefined : () => setFaMethod('web')}
        onDone={onDone(isTa)}
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
  onWeb?: () => void;
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
  const faSub = !p.isTa && h.high ? `→ FRAME 이 ${leanText(leanOfLonglHigh(h.high))} · F.A ${fmt(Math.abs(v!), 2)}°` : null;
  const ready = m.fixed != null && (p.isTa || h.ready);
  const otherDone = p.isTa ? p.done.fa : p.done.ta;
  return (
    <div class="screen">
      {p.bar}
      <div class="steps">
        <span class={p.isTa || p.done.ta ? 'on' : ''} />
        <span class={!p.isTa || p.done.fa ? 'on' : ''} />
      </div>
      <Headline eyebrow={p.isTa ? '1/2 · T.A' : '2/2 · F.A · LONGL. 라인'} title={!p.isTa && !m.manual && m.sensor.status === 'running' ? `폰 머리를 ${dirName(head.dir)} 쪽으로 대주세요` : p.title} sub={p.sub} />
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
      {p.onWeb && (
        <div class="section mt8">
          <button class="text-btn" onClick={p.onWeb}>
            FRAME 웹으로 재기
          </button>
        </div>
      )}
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
                  method: p.isTa ? undefined : 'line',
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

/**
 * F.A · FRAME 웹 : 폰 뒷면을 웹에 붙여 판이 연직에서 누운 각을 잰다.
 * 1) 보는 쪽 확인 (잴 때마다) → 2) 폰 머리 위로 고정 → 3) 거꾸로 돌려 같은 자리 고정 → 평균.
 * 두 번 재면 케이스 · 카메라 돌출부로 들뜬 만큼이 서로 지워진다.
 */
const HEAD_MIN = 20; // 머리 위 / 아래를 가르는 긴 축 기울기 (°)
const DIFF_WARN = 0.5; // 두 값 차이가 이보다 크면 뒷면이 들뜬 것

function WebStep(p: {
  bar: preact.JSX.Element;
  done: { ta: boolean; fa: boolean };
  design: number | null;
  designLabel: string;
  onGuide: () => void;
  onLine: () => void;
  onDone: (r: Reading) => void;
  children: preact.ComponentChildren;
}) {
  const s = useSettings();
  const t = useTilt();
  useWakeLock();
  const [facing, setFacing] = useState<Dir>(1);
  const [facingOk, setFacingOk] = useState(false);
  const [f1, setF1] = useState<number | null>(null);
  const [f2, setF2] = useState<number | null>(null);
  const phase = f1 == null ? 1 : f2 == null ? 2 : 3;
  const running = t.status === 'running';
  const needCal = s.faceBias == null;
  const ang = t.angle ?? 0;
  const orientOk = phase === 1 ? ang > HEAD_MIN : phase === 2 ? ang < -HEAD_MIN : true;
  const value = phase === 3 ? (f1! + f2!) / 2 : running && !t.moving ? t.face : null;
  const lean = value == null || !facingOk ? null : leanFromFace(value, facing);
  const diff = phase === 3 ? Math.abs(f1! - f2!) : null;
  const otherDone = p.done.ta;

  const hold = () => {
    if (phase === 3 || !running) return;
    if (!facingOk) return toast('보는 쪽을 먼저 확인해주세요');
    if (needCal) return toast('뒷면 보정을 먼저 해주세요');
    if (t.moving) return toast('움직이고 있어요. 웹에 붙이고 멈춰주세요');
    if (!orientOk) return toast(phase === 1 ? '폰 머리(카메라 쪽)를 위로 해서 붙여주세요' : '폰을 거꾸로 돌려 머리를 아래로 해주세요');
    if (!t.faceStable || t.face == null) return toast('아직 흔들려요. 잠시 그대로 붙여주세요');
    vibrate(50);
    if (phase === 1) setF1(t.face);
    else setF2(t.face);
    tilt.reset();
  };
  const restart = () => {
    setF1(null);
    setF2(null);
    tilt.reset();
  };

  const title = !facingOk ? '선수를 보고 서서 FRAME 웹에 폰 뒷면을 붙여주세요' : phase === 1 ? '폰 머리를 위로 해서 웹에 붙여주세요' : phase === 2 ? '폰을 거꾸로 돌려 같은 자리에 붙여주세요' : '두 번 잰 값을 평균했어요';
  const status = phase === 3 ? { cls: 'held', t: '평균' } : !running ? { cls: 'live', t: '센서 준비 중' } : t.moving ? { cls: 'moving', t: '움직임 감지' } : t.faceStable && orientOk ? { cls: 'stable', t: '안정' } : { cls: 'live', t: '측정 중' };
  const hint = phase === 3 ? '다시 재려면 아래 ‘다시’를 눌러요' : !orientOk ? (phase === 1 ? '폰 머리(카메라 쪽)를 위로 해서 붙여요' : '폰을 거꾸로 돌려 머리를 아래로 붙여요') : '안정되면 화면 아무 곳이나 눌러 고정해요';

  return (
    <div class="screen">
      {p.bar}
      <div class="steps">
        <span class={p.done.ta ? 'on' : ''} />
        <span class="on" />
      </div>
      <Headline eyebrow="2/2 · F.A · FRAME 웹" title={title} sub="보강재 · 용접 · 구멍을 피한 평평한 곳" />
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

      {running && needCal && (
        <div class="alert warn">
          <IWarn />
          <div>
            <b>처음 한 번 뒷면 보정이 필요해요</b>
            <span>책상에 화면이 위로 한 번, 엎어서 한 번 놓으면 끝나요</span>
            <button class="btn small dark mt8" onClick={() => go('/settings/calibrate-face')}>
              뒷면 보정하기
            </button>
          </div>
        </div>
      )}

      {running && (
        <div class={'head-card' + (facingOk ? ' ok' : '')}>
          <FacingFigure facing={facing} />
          <div class="head-body">
            <div class="head-t">보는 쪽 → {dirName(facing)}</div>
            {facingOk ? (
              <>
                <div class="head-s">{dirName(facing)}를 보고 선 것으로 계산해요</div>
                <button
                  class="text-btn"
                  onClick={() => {
                    setFacing((d) => -d as Dir);
                    restart();
                  }}
                >
                  {dirName(-facing as Dir)}를 보고 있어요
                </button>
              </>
            ) : (
              <>
                <div class="head-s">반대로 서면 누운 쪽이 뒤집혀 F.A 방향이 틀려요</div>
                <button class="btn small" onClick={() => setFacingOk(true)}>
                  네, {dirName(facing)}를 보고 있어요
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {t.status === 'need-permission' ? (
        <div class="reading center" style={{ cursor: 'default', padding: '28px 20px' }}>
          <div style={{ fontSize: '17px', fontWeight: 700 }}>기울기 센서를 켜주세요</div>
          <button class="btn small mt16" onClick={() => tilt.requestPermission()}>
            센서 켜기
          </button>
        </div>
      ) : t.status === 'unsupported' || t.status === 'denied' ? (
        <div class="section">
          <div class="card note" style={{ marginTop: 0 }}>
            센서를 쓸 수 없어 FRAME 웹은 잴 수 없어요. LONGL. 라인을 디지털 수평계로 재주세요.
          </div>
        </div>
      ) : (
        <div class={'reading' + (phase === 3 ? ' held' : t.faceStable && orientOk && !t.moving ? ' stable' : '')} onClick={hold} role="button" aria-label="값 고정하기">
          <div class="reading-head">
            <span class={'status-dot ' + status.cls}>{status.t}</span>
            <span class="num">{phase === 1 ? '1/2 · 머리 위' : phase === 2 ? `2/2 · 머리 아래 · 첫 값 ${fmt(Math.abs(f1!), 2)}°` : `${fmt(Math.abs(f1!), 2)}° · ${fmt(Math.abs(f2!), 2)}°`}</span>
          </div>
          <div class="big num">
            <span class="arrow" aria-hidden="true" />
            <span class={'v' + (value == null ? ' idle' : '')}>{value == null ? '—' : fmt(Math.abs(value), phase === 3 ? 2 : s.decimals)}</span>
            <span class="deg">°</span>
          </div>
          <div class="dev-line num">
            <span>도면 대비</span>
            <span class={'dv c-' + devLevel(value == null || p.design == null ? null : Math.abs(value) - Math.abs(p.design), s)}>
              {value == null || p.design == null ? '—' : fmtSigned(Math.abs(value) - Math.abs(p.design), s.decimals) + '°'}
            </span>
          </div>
          <div class="reading-hint">{hint}</div>
        </div>
      )}

      {running && facingOk && value != null && (
        <div class="section mt16">
          <div class="fa-dir-card" style={{ marginBottom: 0 }}>
            <LeanFigure lean={lean} />
            <div>
              <span>FRAME 웹</span>
              <b class="num">{lean ? `${dirName(lean)} 쪽으로 ${fmt(Math.abs(value), 2)}° 누웠어요` : '거의 수직이에요'}</b>
              <i />
              <span>{phase === 3 ? '이렇게 저장돼요' : '지금 값이면'}</span>
              <strong class="num">{lean ? `F.A ${dirName(lean)} ${fmt(Math.abs(value), 2)}°` : 'F.A 0°'}</strong>
            </div>
          </div>
        </div>
      )}

      {diff != null && diff > DIFF_WARN && (
        <div class="alert warn mt16">
          <IWarn />
          <div>
            <b>두 번 잰 값이 {fmt(diff, 2)}° 달라요</b>
            <span>폰 뒷면이 웹에서 들떠 있어요. 케이스 · 카메라 돌출부를 확인하고 다시 재면 더 정확해요</span>
          </div>
        </div>
      )}

      <div class="section mt8">
        <button class="text-btn grey" onClick={p.onLine}>
          LONGL. 라인으로 재기
        </button>
      </div>
      <RefNote />
      <RefWarningSheet />
      <Cta>
        {phase < 3 ? (
          <button class="btn" disabled={!running || !facingOk || needCal} onClick={hold}>
            {!facingOk ? '보는 쪽을 먼저 확인해주세요' : needCal ? '뒷면 보정을 먼저 해주세요' : phase === 1 ? '첫 번째 고정' : '두 번째 고정'}
          </button>
        ) : (
          <>
            <button class="btn grey" onClick={restart}>
              다시
            </button>
            <button
              class="btn"
              onClick={() =>
                p.onDone({
                  v: Math.abs(value!),
                  high: lean ? longlHighOfLean(lean) : undefined,
                  at: Date.now(),
                  method: 'web',
                })
              }
            >
              {otherDone ? '저장하고 확인' : '저장하고 T.A 재기'}
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
  const lean = leanOf(p.rFa); // = refFaDir
  const web = p.rFa.method === 'web';
  const design = hasDesign(block);
  const taCmp = design ? designSlope(block.ta!, block.fa!) : null; // 도면 T.A 를 실제 경사로 바꿔 비교
  const dTa = taCmp != null ? refTa - taCmp : null;
  const dFa = design ? refFa - Math.abs(block.fa!) : null;
  const lTa = devLevel(dTa, s);
  const lFa = devLevel(dFa, s);
  const far = lTa === 'bad' || lFa === 'bad';
  const close = lTa === 'good' && lFa === 'good';
  const odd = !blockAnglesLookRight(refTa, refFa);
  // 도면 F.A 방향과 현물 누운 쪽이 반대 (둘 다 뚜렷할 때만)
  const dirClash = design && block.faDir != null && refFaDir != null && refFaDir !== block.faDir && refFa > 0.3 && Math.abs(block.fa!) > 0.3;
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await saveBlock({ ...block, refTa, refFa, refFaDir, refAt: Date.now(), basis: 'ref', updatedAt: Date.now() });
    p.onSaved();
    toast('현물 기준으로 계산해요');
    back('/block/' + block.id);
  };

  const card = (k: string, v: number, d: string | null, lvl: string, dv: number | null) => (
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
          {d} · <em class={'c-' + lvl}>{fmtSigned(dv, 2)}</em>
        </div>
      )}
    </div>
  );
  const taD =
    taCmp == null ? null : Math.abs(taCmp - Math.abs(block.ta!)) >= 0.005 ? `도면 ${fmt(Math.abs(block.ta!), 2)}→경사 ${fmt(taCmp, 2)}` : `도면 ${fmt(taCmp, 2)}`;

  return (
    <div class="screen">
      {p.bar}
      <div class="result-hero">
        <div class={'mark ' + (far || dirClash ? 'warn' : 'blue')}>{far || dirClash ? <IWarn /> : <ICheck />}</div>
        <h1>{dirClash ? 'FRAME 누운 쪽이 도면과 반대예요' : far ? '도면값과 많이 달라요' : '현물 기준을 잡았어요'}</h1>
        <p>{far || dirClash ? (web ? '보는 쪽과 잰 자리를 한 번 더 확인해주세요' : '기준 부재 위치와 폰 머리 방향을 한 번 더 확인해주세요') : '이 블록 측정은 이제 이 값으로 계산해요'}</p>
      </div>
      <div class="section">
        <div class="fa-dir-card">
          <LeanFigure lean={lean} />
          <div>
            <span>{web ? 'FRAME 웹 잰 결과' : `LONGL. 라인 잰 결과${p.rFa.high ? ` · ${dirName(p.rFa.high)} 쪽이 높음` : ''}`}</span>
            <b class="num">{lean ? `FRAME 이 ${dirName(lean)}로 ${fmt(refFa, 2)}° 누움` : '수직'}</b>
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
            <span>실제로 FRAME 이 {lean ? dirName(lean) : ''} 쪽으로 누워 있는지 눈으로 한 번 더 봐주세요</span>
          </div>
        </div>
      )}
      <div class="section ref-cmp num">
        {card('T.A', refTa, taD, lTa, dTa)}
        {card('F.A ' + (refFaDir ? dirName(refFaDir) : ''), refFa, design ? `도면 ${fmt(Math.abs(block.fa!), 2)}` : null, lFa, dFa)}
      </div>
      {dirClash && (
        <div class="alert bad">
          <IWarn />
          <div>
            <b>
              도면은 F.A {dirName(block.faDir!)}({leanText(block.faDir!)})인데, 현물은 {dirName(lean!)}로 누웠어요
            </b>
            <span class="muted">{web ? '선수를 보고 섰는지(보는 쪽 확인)를 다시 봐주세요' : '폰 머리 방향 · 높은 쪽 선택을 확인해주세요'}</span>
          </div>
        </div>
      )}
      {far && (
        <div class="banner">
          <IWarn />
          <div>
            <b>도면과 {fmt(s.tol2, 1)}° 넘게 차이 나요</b>
            <span class="muted">{web ? 'BASE 판이나 보강재 위를 잰 건 아닌지, T.A 를 배 기준 수평선에서 쟀는지 봐주세요' : 'CAMBER · SHEER 구간이거나, 경사 부재 · CENTER LINE 과 평행하지 않은 라인을 잰 건 아닌지 봐주세요'}</span>
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
            <span class="muted">T.A 를 배 기준 수평인 FRAME 방향 선에서 쟀는지 확인해주세요</span>
          </div>
        </div>
      )}
      <Cta>
        <button class="btn grey" onClick={p.onRetry}>
          다시 재기
        </button>
        <button class="btn" disabled={saving} onClick={save}>
          {lean ? `${dirName(lean)}로 누웠어요 · 저장` : '이 기준 쓰기'}
        </button>
      </Cta>
    </div>
  );
}
