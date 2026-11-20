// 현물 기준 재기 : DECK 상면 FRAME 라인(T.A) → LONGL. 라인(F.A) → 확인 후 블록에 저장
import { useEffect, useState } from 'preact/hooks';
import { blockAnglesLookRight } from '../../calc/angle';
import { hasDesign, refFromMeasure } from '../../calc/basis';
import { devLevel, fmt, fmtSigned } from '../../calc/judge';
import { getBlock, saveBlock, type Block } from '../../db/store';
import { useSettings } from '../../settings';
import { useWakeLock } from '../../sensor/tilt';
import { back } from '../router';
import { Cta, Headline, RefNote, RefWarningSheet, Sheet, TopBar, toast } from '../components/ui';
import { ReadingCard, useMeasure } from '../components/reading';
import { IBack, ICheck, IInfo, IWarn } from '../icons';

type Stage = 'ta' | 'fa' | 'done';

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
        <div class="li ok">폰 윗단을 높은 쪽으로 대요</div>
      </div>
      <div class="where">
        <div class="where-h">
          <b>F.A</b> LONGL. 라인
        </div>
        <div class="li ok">CENTER LINE 과 평행한 LONGL. 라인만</div>
        <div class="li ok">GIRDER 류 강력부재 위에서 재요</div>
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
  const [stage, setStage] = useState<Stage>('ta');
  const [ta, setTa] = useState<number | null>(null);
  const [fa, setFa] = useState<number | null>(null);
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

  const stepBack = () => {
    if (stage === 'fa') setStage('ta');
    else if (stage === 'done') setStage('fa');
    else back('/block/' + block.id);
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

  if (stage === 'ta' || stage === 'fa') {
    const isTa = stage === 'ta';
    return (
      <RefStep
        key={stage}
        bar={bar}
        step={isTa ? 1 : 2}
        eyebrow={isTa ? '1/2 · T.A' : '2/2 · F.A'}
        title={isTa ? 'DECK 상면 FRAME 라인에 폰을 대주세요' : 'DECK 상면 LONGL. 라인에 폰을 대주세요'}
        sub={isTa ? 'CAMBER 없는 곳 · 폰 윗단을 높은 쪽으로' : 'CENTER LINE 과 평행한 GIRDER 위 · SHEER 없는 곳'}
        note={isTa ? '용접 비드 · 덧판을 피해 평평한 곳에 대주세요' : 'ANGLE 부재는 변형되기 쉬워요. 되도록 GIRDER 류 강력부재에 대주세요'}
        design={hasDesign(block) ? (isTa ? block.ta : block.fa) : null}
        designLabel={isTa ? '도면 T.A' : '도면 F.A'}
        prev={isTa ? null : ta}
        initial={isTa ? ta : fa}
        onGuide={() => setGuide(true)}
        onDone={(v) => {
          if (isTa) {
            setTa(v);
            setStage('fa');
          } else {
            setFa(v);
            setStage('done');
          }
        }}
      >
        {sheet}
      </RefStep>
    );
  }

  return (
    <RefResult
      bar={bar}
      block={block}
      ta={ta!}
      fa={fa!}
      onRetry={() => {
        setTa(null);
        setFa(null);
        setStage('ta');
      }}
    />
  );
}

function RefStep(p: {
  bar: preact.JSX.Element;
  step: number;
  eyebrow: string;
  title: string;
  sub: string;
  note: string;
  design: number | null;
  designLabel: string;
  prev: number | null;
  initial: number | null;
  onGuide: () => void;
  onDone: (v: number) => void;
  children: preact.ComponentChildren;
}) {
  const m = useMeasure();
  useWakeLock();
  const canHold = m.sensor.status === 'running' && !m.manual;
  return (
    <div class="screen">
      {p.bar}
      <div class="steps">
        <span class="on" />
        <span class={p.step >= 2 ? 'on' : ''} />
      </div>
      <Headline eyebrow={p.eyebrow} title={p.title} sub={p.sub} />
      <div class="section" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span class="normal-pill num">
          {p.prev != null ? (
            <>
              T.A <b>{fmt(Math.abs(p.prev), 2)}°</b> 고정됨
            </>
          ) : p.design != null ? (
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
      <ReadingCard m={m} normal={p.design} compareAbs={true} normalLabel="도면 대비" />
      <RefNote />
      <div class="disclaimer">{p.note}</div>
      <RefWarningSheet />
      <Cta>
        {m.fixed == null ? (
          <button class="btn" disabled={m.manual || !canHold} onClick={m.hold}>
            {m.manual ? '값을 입력해주세요' : '고정하기'}
          </button>
        ) : (
          <>
            {!m.manual && (
              <button class="btn grey" onClick={m.release}>
                다시
              </button>
            )}
            <button class="btn" onClick={() => p.onDone(m.fixed!)}>
              다음
            </button>
          </>
        )}
      </Cta>
      {p.children}
    </div>
  );
}

function RefResult(p: { bar: preact.JSX.Element; block: Block; ta: number; fa: number; onRetry: () => void }) {
  const s = useSettings();
  const { block } = p;
  const { refTa, refFa } = refFromMeasure(p.ta, p.fa);
  const design = hasDesign(block);
  const dTa = design ? refTa - block.ta! : null;
  const dFa = design ? refFa - block.fa! : null;
  const lTa = devLevel(dTa, s);
  const lFa = devLevel(dFa, s);
  const far = lTa === 'bad' || lFa === 'bad';
  const close = lTa === 'good' && lFa === 'good';
  const odd = !blockAnglesLookRight(refTa, refFa);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await saveBlock({ ...block, refTa, refFa, refAt: Date.now(), basis: 'ref', updatedAt: Date.now() });
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
        <div class={'mark ' + (far ? 'warn' : 'blue')}>{far ? <IWarn /> : <ICheck />}</div>
        <h1>{far ? '도면값과 많이 달라요' : '현물 기준을 잡았어요'}</h1>
        <p>{far ? '기준 부재 위치를 한 번 더 확인해주세요' : '이 블록 측정은 이제 이 값으로 계산해요'}</p>
      </div>
      <div class="section ref-cmp num">
        {card('T.A', refTa, design ? block.ta : null, lTa, dTa)}
        {card('F.A', refFa, design ? block.fa : null, lFa, dFa)}
      </div>
      {far && (
        <div class="banner">
          <IWarn />
          <div>
            <b>도면과 {fmt(s.tol2, 1)}° 넘게 차이 나요</b>
            <span class="muted">CAMBER · SHEER 구간이거나, 경사 부재 · CENTER LINE 과 평행하지 않은 라인을 잰 건 아닌지 봐주세요</span>
          </div>
        </div>
      )}
      {!far && close && (
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
          이 기준 쓰기
        </button>
      </Cta>
    </div>
  );
}
