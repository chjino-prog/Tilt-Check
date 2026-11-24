// 지주캡 측정 : 측정 순서(잰 값은 단계마다 저장) → B 측정 → A 측정 → 결과(역산 · 잔차 · 판정)
// 부호는 쓰지 않는다 — B 는 "숫자 + 높은 쪽(선수/선미)", A 는 숫자만. 부호는 calc/sign.ts 가 붙인다.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Dir } from '../../calc/angle';
import { basisName, effectiveAngles, taText, type Effective } from '../../calc/basis';
import { capGeom, capResult } from '../../calc/capcalc';
import { capDirText, capVerdict, fmt, fmtSigned, parseNum, verdictLevel } from '../../calc/judge';
import { analyzeCapDir, bDevText, bText, capDirOf, capNormalDir, dirName, dirSuspect, faHighSide, flipSuspect, highOfB, highSensitive, leanText, rotText, signedA, signedB, type CapGeom } from '../../calc/sign';
import { clearDraft, loadDraft, saveDraft, type Draft, type Reading } from '../../db/draft';
import { deleteCap, getBlock, getCap, newId, saveBlock, saveRecord, type Block, type Cap } from '../../db/store';
import { setSettings, useSettings } from '../../settings';
import { useWakeLock } from '../../sensor/tilt';
import { back, go } from '../router';
import { ConfirmSheet, Cta, Headline, MenuRow, NumInput, RefNote, RefWarningSheet, Seg, Sheet, TopBar, toast } from '../components/ui';
import { HeadCard, HighPicker, ReadingCard, useHead, useHighSide, useMeasure } from '../components/reading';
import { Gauge, PlanFigure } from '../components/gauge';
import { IBack, ICamera, ICheck, IChevron, IEdit, IImage, IInfo, IMinus, IMore, IRuler, ITrash, IWarn, IX } from '../icons';
import { CapFaceSeg, CapSheet } from './edit-sheets';
import { makePhoto } from './photo';

type Stage = 'ready' | 'B' | 'A' | 'result';

/** 캡 종류별 부재 번호 (지주캡 측정 방향 그림 기준) */
export function capLines(no: string) {
  const n = no.trim().toUpperCase();
  if (n.startsWith('TS')) return { b: '④ 주판 · ②·③ 과 평행', a: '④ 주판 · ① 과 평행' };
  if (n.startsWith('PSA')) return { b: '③ 주판 · ④·⑤ 와 평행', a: '③ 주판 · ①·② 와 평행' };
  return { b: '주판 · WEB 직각 (브라켓과 평행)', a: '주판 · WEB 과 평행' };
}

/** 높은 쪽 글자만 : "선미 높음" */
function sideText(b: number, faDir: Dir): string {
  const h = highOfB(b, faDir);
  return h ? dirName(h) + ' 높음' : '수평';
}

const hhmm = (t: number) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export function GuideSheet(p: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={p.open} onClose={p.onClose}>
      <h2>측정 방향</h2>
      <p class="sub">기준은 FRAME 선이 아니라 캡 자신의 WEB · 브라켓이에요. δ 가 있는 캡도 같아요</p>
      <div class="where">
        <div class="li ok">
          <span>
            <b>각도 A · WEB 방향</b> 주판 위, WEB 과 평행. 숫자만 넣어요
          </span>
        </div>
        <div class="li ok">
          <span>
            <b>각도 B · WEB 직각</b> 주판 위, 브라켓과 평행. 폰 머리(카메라 쪽)를 선수로
          </span>
        </div>
        <div class="li no">
          <span>FRAME 선을 따라 대거나, 폰 긴 축을 위아래로 세워 WEB 면에 대면 틀려요</span>
        </div>
      </div>
      <div class="guide-h mt16">폰으로 잴 때</div>
      <a href={`${import.meta.env.BASE_URL}cap-phone.svg`} target="_blank" rel="noopener">
        <img
          class="guide-img"
          src={`${import.meta.env.BASE_URL}cap-phone.svg`}
          alt="폰 대는 법 — A 는 폰을 세워 WEB 에 기대고 긴 옆면을 주판에, B 는 가운데 브라켓에 기대고 카메라 쪽을 선수로. 긴 축을 위아래로 세우면 틀림. 세운 폰 권장, 눕힌 폰은 뒷면이 평평할 때만"
        />
      </a>
      <div class="guide-h mt16">디지털 수평계로 잴 때</div>
      <a href={`${import.meta.env.BASE_URL}cap-guide.webp`} target="_blank" rel="noopener">
        <img
          class="guide-img"
          src={`${import.meta.env.BASE_URL}cap-guide.webp`}
          alt="지주캡 측정 방향 그림 — TS 는 ④ 주판, PSA 는 ③ 주판. 각도 A 는 WEB 과 평행, 각도 B 는 브라켓과 평행"
        />
      </a>
      <div class="note center">그림을 누르면 크게 봐요</div>
      <div class="actions mt16">
        <button class="btn" onClick={p.onClose}>
          확인
        </button>
      </div>
    </Sheet>
  );
}

/** 예전 블록 : F.A 방향을 아직 안 정했으면 여기서 바로 정한다 */
function FaDirSheet(p: { open: boolean; block: Block; onClose: () => void; onSaved: (b: Block) => void }) {
  const eff = effectiveAngles(p.block);
  const ref = eff?.basis === 'ref';
  const [d, setD] = useState<Dir>(eff?.faDir ?? 1);
  useEffect(() => {
    if (p.open) setD(effectiveAngles(p.block)?.faDir ?? 1);
  }, [p.open]);
  return (
    <Sheet open={p.open} onClose={p.onClose}>
      <h2>FRAME 이 어느 쪽으로 누웠어요?</h2>
      <p class="sub">{ref ? '현물 기준 F.A 방향이에요. FRAME 이 누운 쪽 = LONGL. 라인이 낮은 쪽이에요' : '도면 F.A 방향 그대로예요 (F.A 선미로 3.2° = 선미 쪽으로 누움)'}</p>
      <Seg<Dir>
        value={d}
        onChange={setD}
        options={[
          { v: 1, label: '선수 쪽' },
          { v: -1, label: '선미 쪽' },
        ]}
      />
      <div class="actions mt16">
        <button class="btn grey" onClick={p.onClose}>
          닫기
        </button>
        <button
          class="btn"
          onClick={async () => {
            const nb = ref ? { ...p.block, refFaDir: d, updatedAt: Date.now() } : { ...p.block, faDir: d, updatedAt: Date.now() };
            await saveBlock(nb);
            p.onSaved(nb);
          }}
        >
          저장
        </button>
      </div>
    </Sheet>
  );
}

/** 잴 때 지주캡이 보는 쪽 (블록 설정) — 방향 보류 화면에서 바로 고친다 */
function CapUpSheet(p: { open: boolean; block: Block; onClose: () => void; onSaved: (b: Block) => void }) {
  const [up, setUp] = useState(!!p.block.capUp);
  useEffect(() => {
    if (p.open) setUp(!!p.block.capUp);
  }, [p.open]);
  return (
    <Sheet open={p.open} onClose={p.onClose}>
      <h2>잴 때 지주캡이 어디를 봐요?</h2>
      <p class="sub">보통은 바닥이에요. 턴오버해서 캡이 하늘을 볼 때 쟀다면 '하늘' — 캡 WEB 의 외판 쪽 끝이 위로 와서 방향 계산을 뒤집어요</p>
      <CapFaceSeg up={up} onChange={setUp} />
      <div class="actions mt16">
        <button class="btn grey" onClick={p.onClose}>
          닫기
        </button>
        <button
          class="btn"
          onClick={async () => {
            const nb = { ...p.block, capUp: up || undefined, updatedAt: Date.now() };
            await saveBlock(nb);
            p.onSaved(nb);
          }}
        >
          저장
        </button>
      </div>
    </Sheet>
  );
}

export function CapScreen(p: { blockId: string; capId: string }) {
  const s = useSettings();
  const [block, setBlock] = useState<Block | null | undefined>(undefined);
  const [cap, setCap] = useState<Cap | null | undefined>(undefined);
  const [stage, setStage] = useState<Stage>('ready');
  const [draft, setDraftState] = useState<Draft>(() => loadDraft('cap', p.capId));
  const [menu, setMenu] = useState(false);
  const [guide, setGuide] = useState(false);
  const [editing, setEditing] = useState(false);
  const [faSheet, setFaSheet] = useState(false);
  const [upSheet, setUpSheet] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const load = async () => {
    const [b, c] = await Promise.all([getBlock(p.blockId), getCap(p.capId)]);
    setBlock(b ?? null);
    setCap(c ?? null);
  };
  useEffect(() => {
    load();
    setDraftState(loadDraft('cap', p.capId));
  }, [p.blockId, p.capId]);

  /** 잰 값은 단계마다 바로 저장 — 화면을 나가도 남는다 */
  const putDraft = (d: Draft) => {
    setDraftState(d);
    saveDraft('cap', p.capId, d);
  };

  if (block === undefined || cap === undefined) return <div class="screen" />;
  if (!block || !cap)
    return (
      <div class="screen">
        <TopBar />
        <Headline title="지주캡을 찾을 수 없어요" />
      </div>
    );

  const eff = effectiveAngles(block);
  if (!eff)
    return (
      <div class="screen">
        <TopBar backTo={'/block/' + block.id} />
        <Headline eyebrow={`${block.ship} 호선 · ${block.block}`} title="T.A · F.A 가 아직 없어요" sub="블록에 도면값을 넣거나, 현물 기준 부재에서 재주세요" />
        <Cta>
          <button class="btn" onClick={() => go(`/block/${block.id}/ref`, true)}>
            현물에서 재기
          </button>
        </Cta>
      </div>
    );
  const g = capGeom(cap, block);
  const normal = capNormalDir(eff.ta, eff.fa, eff.faDir, cap.delta, cap.dir, g);
  const dirText = capDirText(cap.delta, cap.dir);
  const noShell = Math.abs(cap.delta) >= 1e-9 && g.shell == null;
  const aWeak = normal.dA < s.aSensMin;
  const lines = capLines(cap.no);
  const title = `캡 ${cap.no}`;
  const rB = draft.first;
  const rA = draft.second;
  const faUnset = !eff.faDirSet && eff.fa > 0.05;

  /** 한 방향을 저장하면 아직 안 잰 방향으로, 둘 다 있으면 결과로 */
  const nextAfter = (d: Draft): Stage => (!d.first ? 'B' : !d.second ? 'A' : 'result');

  const stepBack = () => {
    if (stage === 'ready') back('/block/' + block.id);
    else setStage('ready'); // 잰 값은 그대로 두고 측정 순서 화면으로
  };

  const bar = (
    <header class="topbar">
      <button class="icon-btn" aria-label="뒤로" onClick={stepBack}>
        <IBack />
      </button>
      <div class="title">{stage === 'ready' ? '' : title}</div>
      <button class="icon-btn" aria-label="더보기" onClick={() => setMenu(true)}>
        <IMore />
      </button>
    </header>
  );

  const sheets = (
    <>
      <Sheet open={menu} onClose={() => setMenu(false)}>
        <MenuRow icon={IImage} label="측정 방향 그림" onClick={() => (setMenu(false), setGuide(true))} />
        {(rA || rB) && (
          <MenuRow
            icon={IRuler}
            label="잰 값 지우고 처음부터"
            onClick={() => {
              setMenu(false);
              clearDraft('cap', cap.id);
              setDraftState({});
              setStage('ready');
            }}
          />
        )}
        <MenuRow icon={IEdit} label="지주캡 수정" onClick={() => (setMenu(false), setEditing(true))} />
        <MenuRow icon={ITrash} label="지주캡 삭제" danger onClick={() => (setMenu(false), setConfirmDel(true))} />
      </Sheet>
      <GuideSheet open={guide} onClose={() => setGuide(false)} />
      <FaDirSheet
        open={faSheet}
        block={block}
        onClose={() => setFaSheet(false)}
        onSaved={(b) => {
          setFaSheet(false);
          setBlock(b);
          toast(`FRAME 이 ${dirName(effectiveAngles(b)?.faDir ?? 1)} 쪽으로 누운 것으로 계산해요`);
        }}
      />
      <CapUpSheet
        open={upSheet}
        block={block}
        onClose={() => setUpSheet(false)}
        onSaved={(b) => {
          setUpSheet(false);
          setBlock(b);
          toast(b.capUp ? '캡이 하늘을 보는 자세(턴오버 후)로 계산해요' : '캡이 바닥을 보는 자세로 계산해요');
        }}
      />
      <CapSheet
        open={editing}
        blockId={block.id}
        cap={cap}
        onClose={() => setEditing(false)}
        onSaved={(c) => {
          setEditing(false);
          setCap(c);
        }}
      />
      <ConfirmSheet
        open={confirmDel}
        title={`캡 ${cap.no}을(를) 지울까요?`}
        sub="지금까지의 측정 기록은 남아 있어요."
        okLabel="지우기"
        danger
        onClose={() => setConfirmDel(false)}
        onOk={async () => {
          await deleteCap(cap.id);
          clearDraft('cap', cap.id);
          toast('지주캡을 지웠어요');
          back('/block/' + block.id);
        }}
      />
    </>
  );

  if (stage === 'ready') {
    const step = (key: 'B' | 'A', name: string, where: string, r: Reading | undefined, side?: string) => (
      <button class="row" onClick={() => setStage(key)}>
        <div class={'lead ' + (r ? 'done' : 'blue')}>{r ? <ICheck /> : key}</div>
        <div class="body">
          <div class="t1">{name}</div>
          <div class="t2">{where}</div>
        </div>
        {r ? (
          <div class="saved num">
            <b>{fmt(r.v, 2)}°</b>
            <span>
              {side ? side + ' · ' : ''}
              {hhmm(r.at)}
            </span>
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
        <Headline
          eyebrow={`${block.ship} 호선 · ${block.block}`}
          title={title}
          sub={
            <span class="num">
              δ {fmt(cap.delta, 2)}°{dirText && ` · ${dirText} 쪽으로 돌아간 캡`}
              {g.shell != null && ` · 외판 ${fmt(g.shell, 1)}°`}
            </span>
          }
        />
        {noShell && (
          <div class="banner">
            <IWarn />
            <div>
              <b>캡 자리 외판 기울기가 없어요</b>
              <span class="muted">도면 δ 는 외판 위 각도라, 외판이 서 있으면 회전오차가 크게 틀려요. 지금은 외판이 누운 것으로 계산해요</span>
              <div>
                <button class="text-btn mt8" onClick={() => setEditing(true)}>
                  외판 기울기 넣기
                </button>
              </div>
            </div>
          </div>
        )}
        {faUnset && (
          <div class="banner">
            <IWarn />
            <div>
              <b>FRAME 이 누운 쪽(F.A 방향)을 아직 안 정했어요</b>
              <span class="muted">지금은 선수로 계산해요. 방향이 틀리면 회전오차가 크게 틀어져요</span>
              <div>
                <button class="text-btn mt8" onClick={() => setFaSheet(true)}>
                  누운 쪽 정하기
                </button>
              </div>
            </div>
          </div>
        )}
        <div class="section">
          <div class="card">
            <BasisLine eff={eff} up={g.up} />
            <div class="stat-grid">
              <div class="stat">
                <div class="k">정상 B · WEB 직각</div>
                <div class="v num">
                  {fmt(Math.abs(normal.thetaB), 2)}
                  <small>°</small>
                </div>
                <div class="k">{sideText(normal.thetaB, eff.faDir)}</div>
              </div>
              <div class={'stat' + (aWeak ? ' muted' : '')}>
                <div class="k">정상 A · WEB 방향</div>
                <div class="v num">
                  {fmt(Math.abs(normal.thetaA), 2)}
                  <small>°</small>
                </div>
              </div>
              <div class="stat">
                <div class="k">B 1°당 변화 dB</div>
                <div class="v num">{fmt(normal.dB, 2)}</div>
              </div>
              <div class={'stat' + (aWeak ? ' muted' : '')}>
                <div class="k">A 1°당 변화 dA</div>
                <div class="v num">{fmt(normal.dA, 2)}</div>
              </div>
            </div>
            {aWeak && <div class="note">A는 회전판정 불가(참고) — 캡이 1° 돌아도 A가 {fmt(normal.dA, 2)}° 밖에 안 바뀌어요</div>}
            {g.shell != null && (
              <div class="note num">
                외판이 {fmt(g.shell, 1)}° 라 캡 상판은 {fmt(normal.deltaCap, 2)}° 돌아간 것으로 계산해요 · 1°당 변화는 도면 δ 1°당
              </div>
            )}
          </div>
        </div>
        <div class="section-title">
          <span>{rA || rB ? '잰 값은 저장돼 있어요' : '이렇게 재요'}</span>
          <button class="text-btn" onClick={() => setGuide(true)}>
            그림 보기
          </button>
        </div>
        <div class="list">
          {step('B', '각도 B · WEB 직각 (브라켓 방향)', lines.b, rB, rB ? (rB.high ? dirName(rB.high) + ' 높음' : '수평') : undefined)}
          {step('A', '각도 A · WEB 방향', lines.a, rA)}
        </div>
        <Cta>
          <button class="btn" onClick={() => setStage(next)}>
            {next === 'B' ? (rA ? 'B 재기' : '측정 시작') : next === 'A' ? 'A 재기' : '결과 보기'}
          </button>
        </Cta>
        {sheets}
      </div>
    );
  }

  if (stage === 'B' || stage === 'A') {
    const isB = stage === 'B';
    return (
      <StepScreen
        key={stage}
        bar={bar}
        isB={isB}
        done={{ B: !!rB, A: !!rA }}
        title={isB ? '주판에 WEB 과 직각으로 대주세요' : '주판에 WEB 과 평행하게 대주세요'}
        sub={isB ? lines.b : lines.a + ' · 어느 쪽으로 대도 돼요'}
        normal={isB ? normal.thetaB : normal.thetaA}
        faDir={eff.faDir}
        weak={!isB && aWeak}
        sensitive={isB && highSensitive(eff.ta, eff.fa, eff.faDir, cap.delta, cap.dir, s.rotTol, g)}
        onGuide={() => setGuide(true)}
        onDone={(r) => {
          const d = isB ? { ...draft, first: r } : { ...draft, second: r };
          putDraft(d);
          setStage(nextAfter(d));
        }}
      >
        {sheets}
      </StepScreen>
    );
  }

  if (!rA || !rB) {
    // 결과에 필요한 값이 없으면 순서 화면으로
    setStage('ready');
    return <div class="screen" />;
  }

  return (
    <ResultScreen
      bar={bar}
      block={block}
      cap={cap}
      eff={eff}
      rA={rA}
      rB={rB}
      g={g}
      onRetryB={() => setStage('B')}
      onEditCap={() => setEditing(true)}
      onEditFa={() => setFaSheet(true)}
      onEditUp={() => setUpSheet(true)}
      onRetry={() => setStage('ready')}
      onSaved={() => clearDraft('cap', cap.id)}
    >
      {sheets}
    </ResultScreen>
  );
}

/** 정상값 카드 위 한 줄 : 어느 기준 · 자세로 계산했는지 */
function BasisLine(p: { eff: Effective; up?: boolean }) {
  return (
    <div class="basis-line num">
      <span>
        {basisName(p.eff.basis)} 기준 · T.A {taText(p.eff, (v) => fmt(v, 2))} · F.A {fmt(p.eff.fa, 2)}° {leanText(p.eff.faDir)}
      </span>
      {(p.eff.basis === 'ref' || p.up) && (
        <span class="badges">
          {p.up && <span class="badge warn">턴오버 후</span>}
          {p.eff.basis === 'ref' && <span class="badge blue">현물</span>}
        </span>
      )}
    </div>
  );
}

function StepScreen(p: {
  bar: preact.JSX.Element;
  isB: boolean;
  done: { B: boolean; A: boolean };
  title: string;
  sub: string;
  normal: number;
  faDir: Dir;
  weak: boolean;
  sensitive: boolean;
  onGuide: () => void;
  onDone: (r: Reading) => void;
  children: preact.ComponentChildren;
}) {
  const head = useHead();
  // B 를 센서로 잴 때는 폰 머리 방향을 확인해야 고정할 수 있다
  const m = useMeasure(p.isB && !head.ok ? '먼저 폰 머리 방향을 확인해주세요' : null);
  const h = useHighSide(m, head);
  useWakeLock();
  const v = m.value;
  // 계산용 부호 : B 는 높은 쪽으로, A 는 정상값 부호를 따라간다
  const signed = v == null ? null : p.isB ? (h.flat ? 0 : h.high ? signedB(v, h.high, p.faDir) : null) : signedA(v, p.normal);
  const dev = signed == null ? null : signed - p.normal;
  const sensorB = p.isB && !m.manual && m.sensor.status === 'running';
  const needHead = sensorB && !head.ok;
  const canHold = m.sensor.status === 'running' && !m.manual && !needHead;
  const ready = m.fixed != null && (!p.isB || h.ready);
  const otherDone = p.isB ? p.done.A : p.done.B;
  const title = !p.isB ? p.title : m.manual ? '숫자와 높은 쪽을 넣어주세요' : sensorB ? `폰 머리를 ${dirName(head.dir)} 쪽으로 대주세요` : p.title;
  const summary = p.isB && v != null ? (h.flat ? '수평' : h.high ? `${dirName(h.high)} 쪽이 ${fmt(Math.abs(v), 2)}° 높음` : null) : null;
  return (
    <div class="screen">
      {p.bar}
      <div class="steps">
        <span class={p.isB || p.done.B ? 'on' : ''} />
        <span class={!p.isB || p.done.A ? 'on' : ''} />
      </div>
      <Headline eyebrow={p.isB ? (m.manual ? '각도 B · 디지털 수평계' : '각도 B · WEB 직각') : '각도 A · WEB 방향'} title={title} sub={p.sub} />
      <div class="section" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span class="normal-pill num">
          정상 <b>{p.isB ? bText(p.normal, p.faDir) : fmt(Math.abs(p.normal), 2) + '°'}</b>
        </span>
        <button class="text-btn" onClick={p.onGuide}>
          위치 그림
        </button>
      </div>
      {p.sensitive && (
        <div class="alert warn">
          <IWarn />
          <div>
            <b>높은 쪽 하나로 OK · NG 가 바뀌는 캡이에요</b>
            <span>
              {Math.abs(p.normal) < 2 ? `정상 B 가 ${fmt(Math.abs(p.normal), 2)}° 로 거의 수평이에요. ` : ''}
              {m.manual ? '수평계 화살표로 어느 쪽이 높은지 꼭 보고 골라주세요' : '폰 머리 방향을 꼭 맞게 대고 재주세요'}
            </span>
          </div>
        </div>
      )}
      {p.weak && (
        <div class="banner info">
          <IInfo />
          <div>
            <b>이 캡은 A로 회전을 판정하기 어려워요</b>
            <span class="muted">A 값은 참고로만 봐요</span>
          </div>
        </div>
      )}
      {p.isB && <HeadCard m={m} head={head} />}
      <ReadingCard m={m} normal={p.normal} compareAbs={false} normalLabel="정상 대비" unsigned dev={dev} />
      {p.isB && <HighPicker m={m} h={h} head={head} summary={summary} sub={dev == null ? null : bDevText(dev, p.faDir)} />}
      <Gauge dev={dev} />
      <RefNote />
      <div class="disclaimer">폰은 세워서 긴 옆면을 주판에 대요. 눕히면 카메라 돌출부 때문에 머리 쪽이 들떠요</div>
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
                  high: p.isB && !h.flat ? h.high ?? undefined : undefined,
                  at: Date.now(),
                  manual: m.manual || undefined,
                })
              }
            >
              {!ready ? '높은 쪽을 골라주세요' : otherDone ? '저장하고 결과 보기' : p.isB ? '저장하고 A 재기' : '저장하고 B 재기'}
            </button>
          </>
        )}
      </Cta>
      {p.children}
    </div>
  );
}

function ResultScreen(p: {
  bar: preact.JSX.Element;
  block: Block;
  cap: Cap;
  eff: Effective;
  rA: Reading;
  rB: Reading;
  g: CapGeom;
  onRetryB: () => void;
  onEditCap: () => void;
  onEditFa: () => void;
  onEditUp: () => void;
  onRetry: () => void;
  onSaved: () => void;
  children: preact.ComponentChildren;
}) {
  const s = useSettings();
  const { block, cap, eff, g } = p;
  const capDir = capDirOf(cap.delta, cap.dir);
  // 현장 기록(크기 + 높은 쪽) → 계산용 부호
  const measB = p.rB.high ? signedB(p.rB.v, p.rB.high, eff.faDir) : 0;
  // 계산은 capcalc 한 곳에서 — 실제 δ · 회전오차는 도면과 같은 외판 위 각도
  const res = useMemo(
    () => capResult({ ta: eff.ta, fa: eff.fa, faDir: eff.faDir, delta: cap.delta, capDir, g: { shell: g.shell, up: g.up } }, p.rA.v, measB, s),
    [eff.ta, eff.fa, eff.faDir, cap.delta, capDir, g.shell, g.up, p.rA.v, measB, s],
  );
  const r = res.analysis;
  const measA = res.fields.measA!;
  const flipped = useMemo(
    () => analyzeCapDir(eff.ta, eff.fa, eff.faDir, cap.delta, capDir, measA, -measB, { shell: g.shell, up: g.up }),
    [eff.ta, eff.fa, eff.faDir, cap.delta, capDir, measA, measB, g.shell, g.up],
  );
  // ① 캡 · F.A 방향 · 턴오버 점검 (A 로) — 의심되면 판정을 보류한다
  const dirS = dirSuspect(eff.ta, eff.fa, eff.faDir, cap.delta, capDir, p.rA.v, g);
  // ② 높은 쪽 : 판정을 가르는 캡이면 두 결과를 나란히, 아니면 반대가 훨씬 그럴듯할 때만
  const sensitive = highSensitive(eff.ta, eff.fa, eff.faDir, cap.delta, capDir, s.rotTol, g);
  const suspect = p.rB.high && !sensitive ? flipSuspect(r, flipped, s.rotTol) : null;
  // ③ A · B 를 바꿔 넣음 (A 는 보통 B 보다 훨씬 크다)
  const swapped = Math.abs(r.thetaA) > Math.abs(r.thetaB) + 5 && p.rA.v < p.rB.v;
  const verdict = capVerdict(r.rotErr, s);
  const flipVerdict = capVerdict(flipped.rotErr, s);
  const lvl = verdictLevel(verdict);
  const residWarn = r.aResid != null && Math.abs(r.aResid) > s.aResidTol;
  const aWeak = r.dA < s.aSensMin;
  const [memo, setMemo] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [tolOpen, setTolOpen] = useState(false);
  const [tolText, setTolText] = useState('');
  const d = 2; // 결과는 항상 소수 2자리 (엑셀 계산시트와 맞춤)
  const highNow = p.rB.high;

  useEffect(() => () => void (photoUrl && URL.revokeObjectURL(photoUrl)), [photoUrl]);

  const heading =
    verdict === 'OK'
      ? '회전오차가 허용 범위 안이에요'
      : verdict === 'NG'
        ? '회전오차가 허용 범위를 넘었어요'
        : verdict === '기준미정'
          ? '판정 기준이 아직 없어요'
          : 'B 값이 계산 범위를 벗어났어요';
  const Mark = verdict === 'OK' ? ICheck : verdict === 'NG' ? IX : verdict === '판정불가' ? IWarn : IMinus;

  const save = async () => {
    setSaving(true);
    await saveRecord({
      ...res.fields, // 정상값 · 실측 · 역산 · 외판 · 자세 · 계산 방식
      id: newId(),
      createdAt: Date.now(),
      blockId: block.id,
      ship: block.ship,
      block: block.block,
      ta: eff.ta,
      taDesign: eff.taDesign,
      fa: eff.fa,
      faDir: eff.faDir,
      basis: eff.basis,
      mode: 'cap',
      capId: cap.id,
      capNo: cap.no,
      highB: p.rB.high,
      verdict,
      memo: memo.trim(),
      photo: photo ?? undefined,
    });
    p.onSaved();
    toast('기록을 저장했어요');
    back('/block/' + block.id);
  };

  if (dirS) {
    const faUnset = !eff.faDirSet;
    return (
      <div class="screen">
        {p.bar}
        <div class="alert-hero">
          <IWarn />
          <h1>방향이 반대로 들어간 것 같아요</h1>
          <p>그래서 판정을 보류했어요. 아래 셋 중 틀린 것을 고치면 같은 측정값으로 다시 계산해요</p>
        </div>
        <div class="section mt16">
          <div class="card dir-card">
            <b>각도 A 로 방향을 맞춰봤어요</b>
            <span class="muted">A 는 캡이 돌아도 거의 안 바뀌고 방향에만 크게 바뀌어요</span>
            <div class="kv">
              <span class="k">A 실측</span>
              <span class="v num">{fmt(p.rA.v, d)}°</span>
            </div>
            <div class="kv">
              <span class="k">지금 방향 정상 A</span>
              <span class="v num">
                {fmt(Math.abs(dirS.aNow), d)}° <em class="c-bad">{fmt(Math.abs(p.rA.v - Math.abs(dirS.aNow)), d)}° 차이</em>
              </span>
            </div>
            <div class="kv">
              <span class="k">반대 방향이면</span>
              <span class="v num">
                {fmt(Math.abs(dirS.aFlip), d)}° <em class="c-good">{fmt(Math.abs(p.rA.v - Math.abs(dirS.aFlip)), d)}° 차이</em>
              </span>
            </div>
          </div>
        </div>
        <div class="section-title">
          <span>셋 중 틀린 쪽을 고쳐주세요</span>
        </div>
        <div class="list">
          <button class="row" onClick={p.onEditFa}>
            <div class="body">
              <div class="t1">블록 FRAME 누운 쪽 (F.A 방향)</div>
              <div class={'t2' + (faUnset ? ' c-bad' : '')}>{faUnset ? '아직 안 정함 (선수로 계산 중)' : `지금 ${leanText(eff.faDir)} · ${basisName(eff.basis)} 기준`}</div>
            </div>
            <span class="chev">
              <IChevron />
            </span>
          </button>
          <button class="row" onClick={p.onEditCap}>
            <div class="body">
              <div class="t1">캡이 돌아간 방향</div>
              <div class="t2">
                지금 {dirName(capDir)} 쪽 · δ {fmt(cap.delta, 2)}°
              </div>
            </div>
            <span class="chev">
              <IChevron />
            </span>
          </button>
          <button class="row" onClick={p.onEditUp}>
            <div class="body">
              <div class="t1">잴 때 지주캡이 보는 쪽</div>
              <div class="t2">{g.up ? '지금 하늘 (턴오버 후)' : "지금 바닥 · 턴오버해서 쟀다면 '하늘'로"}</div>
            </div>
            <span class="chev">
              <IChevron />
            </span>
          </button>
        </div>
        <div class="section">
          <div class="note num">지금 방향대로면 회전오차 {fmtSigned(r.rotErr, d)}° 예요 (참고)</div>
        </div>
        <Cta>
          <button class="btn grey" onClick={p.onRetry}>
            다시 재기
          </button>
          <button class="btn" onClick={faUnset ? p.onEditFa : p.onEditCap}>
            {faUnset ? '누운 쪽 정하기' : '캡 방향 확인하기'}
          </button>
        </Cta>
        {p.children}
      </div>
    );
  }

  return (
    <div class="screen">
      {p.bar}
      <div class="result-hero">
        <div class={'mark ' + (lvl === 'none' ? (verdict === '판정불가' ? 'warn' : 'none') : lvl)}>
          <Mark />
        </div>
        <h1>{heading}</h1>
        {r.rotErr != null && (
          <>
            <div class={'rot num c-' + (lvl === 'none' ? 'none' : lvl)} style={lvl === 'none' ? { color: 'var(--text)' } : undefined}>
              {fmtSigned(r.rotErr, d)}°
            </div>
            <p class="num">
              {rotText(r.rotErr, cap.delta, capDir)} · 실제 δ {fmt(r.deltaReal, d)}° (도면 {fmt(cap.delta, 2)}°)
            </p>
            {g.shell != null && r.deltaRealCap != null && (
              <p class="num">
                외판 {fmt(g.shell, 1)}° · 캡 상판으로는 {fmt(r.deltaRealCap, d)}° (도면이면 {fmt(r.deltaCap, d)}°)
              </p>
            )}
          </>
        )}
        {verdict === '기준미정' && (
          <button class="text-btn mt8" onClick={() => setTolOpen(true)}>
            허용 회전오차 정하기
          </button>
        )}
        {verdict === '판정불가' && <p>B 숫자와 높은 쪽(선수/선미)을 다시 확인해주세요</p>}
      </div>

      {swapped && (
        <div class="alert bad">
          <IWarn />
          <div>
            <b>A · B 를 바꿔 넣은 것 같아요</b>
            <span>A 가 B 보다 작아요. 보통 A 는 T.A 근처, B 는 F.A 근처예요</span>
          </div>
        </div>
      )}

      {highNow && sensitive && (
        <div class="alert warn">
          <IWarn />
          <div>
            <b>높은 쪽이 맞는지 다시 재서 확인해주세요</b>
            <span>{Math.abs(r.thetaB) < 2 ? '이 캡은 B 가 거의 수평이라, 높은 쪽 하나로 결과가 정반대가 돼요' : '이 캡은 높은 쪽 하나로 OK · NG 가 바뀌어요'}</span>
            <div class="two-out num">
              <div class="on">
                <span>기록대로 {dirName(highNow)} 높음</span>
                <b class={'c-' + verdictLevel(verdict)}>
                  {fmtSigned(r.rotErr, d)}° {verdict === 'OK' || verdict === 'NG' ? verdict : ''}
                </b>
              </div>
              <div>
                <span>{dirName(-highNow as Dir)} 높음이었다면</span>
                <b>
                  {fmtSigned(flipped.rotErr, d)}° {flipVerdict === 'OK' || flipVerdict === 'NG' ? flipVerdict : ''}
                </b>
              </div>
            </div>
            <button class="btn small dark mt8" onClick={p.onRetryB}>
              B 다시 재기
            </button>
          </div>
        </div>
      )}

      {suspect != null && highNow && (
        <div class="alert warn">
          <IWarn />
          <div>
            <b>B 높은 쪽을 반대로 고르지 않았나요?</b>
            <span class="num">
              {dirName(-highNow as Dir)} 쪽이 높으면 회전오차가 {fmtSigned(suspect, 2)}° 예요.
              {Math.abs(cap.delta) < 1e-9 ? ` δ 0° 캡은 보통 ${dirName(faHighSide(eff.faDir))} 쪽이 높아요.` : ''}
            </span>
            <button class="btn small dark mt8" onClick={p.onRetryB}>
              B 다시 재기
            </button>
          </div>
        </div>
      )}

      <RefNote />
      <div style={{ height: '16px' }} />

      {residWarn && (
        <div class="banner">
          <IWarn />
          <div>
            <b>A 잔차 {fmtSigned(r.aResid, d)}° — 재측정을 권해요</b>
            <span class="muted">WEB 방향 숙어짐 또는 측정 위치가 의심돼요</span>
          </div>
        </div>
      )}

      <PlanFigure delta={cap.delta} dir={capDir} deltaReal={r.deltaReal} />

      <div class="section mt16">
        <div class="card" style={{ padding: '10px 20px' }}>
          <div class="kv-group">
            <div class="kv">
              <span class="k">계산 기준</span>
              <span class="v num">
                {basisName(eff.basis)} · T.A {taText(eff, (v) => fmt(v, 2))} · F.A {fmt(eff.fa, 2)}° {leanText(eff.faDir)}
              </span>
            </div>
            <div class="kv">
              <span class="k">캡 자세 · 외판</span>
              <span class="v num">
                {g.up ? '하늘 (턴오버 후)' : '바닥'} ·{' '}
                {g.shell != null ? `외판 ${fmt(g.shell, 1)}° → 상판 δ ${fmt(r.deltaCap, d)}°` : Math.abs(cap.delta) < 1e-9 ? 'δ 0 (외판 무관)' : '외판 기울기 없음'}
              </span>
            </div>
          </div>
          <div class="kv-group">
            <div class="kv">
              <span class="k">각도 B 실측{p.rB.manual ? ' (수평계)' : ''}</span>
              <span class="v num">{bText(measB, eff.faDir, d)}</span>
            </div>
            <div class="kv">
              <span class="k">정상 B</span>
              <span class="v num">{bText(r.thetaB, eff.faDir, d)}</span>
            </div>
            <div class="kv">
              <span class="k">B 각도오차</span>
              <span class="v num">{bDevText(r.errB, eff.faDir, d)}</span>
            </div>
          </div>
          <div class="kv-group">
            <div class="kv">
              <span class="k">각도 A 실측{aWeak ? ' (참고)' : ''}</span>
              <span class="v num">{fmt(measA, d)}°</span>
            </div>
            <div class="kv">
              <span class="k">정상 A</span>
              <span class="v num">{fmt(r.thetaA, d)}°</span>
            </div>
            <div class="kv">
              <span class="k">A 각도오차</span>
              <span class="v num">{fmtSigned(r.errA, d)}°</span>
            </div>
            <div class="kv">
              <span class="k">A 예측 (실제 δ 기준)</span>
              <span class="v num">{fmt(r.aPred, d)}°</span>
            </div>
            <div class="kv">
              <span class="k">A 잔차</span>
              <span class={'v num' + (residWarn ? ' c-warn' : '')}>{fmtSigned(r.aResid, d)}°</span>
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="field">
          <label>메모 (선택)</label>
          <input class="input" type="text" value={memo} placeholder="특이사항" onInput={(e) => setMemo((e.target as HTMLInputElement).value)} />
        </div>
        {photoUrl ? (
          <div>
            <img class="photo-thumb" src={photoUrl} alt="첨부 사진" />
            <button
              class="text-btn grey mt8"
              onClick={() => {
                setPhoto(null);
                setPhotoUrl(null);
              }}
            >
              사진 빼기
            </button>
          </div>
        ) : (
          <button class="btn grey" style={{ height: '48px', fontSize: '15px' }} onClick={() => fileRef.current?.click()}>
            <span style={{ width: '20px', height: '20px', display: 'inline-flex' }}>
              <ICamera />
            </span>
            사진 붙이기 (선택)
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={async (e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (!f) return;
            const b = await makePhoto(f);
            setPhoto(b);
            setPhotoUrl(URL.createObjectURL(b));
            (e.target as HTMLInputElement).value = '';
          }}
        />
      </div>

      <Cta>
        <button class="btn grey" onClick={p.onRetry}>
          다시 재기
        </button>
        <button class="btn" disabled={saving} onClick={save}>
          기록 저장
        </button>
      </Cta>
      <Sheet open={tolOpen} onClose={() => setTolOpen(false)}>
        <h2>허용 회전오차</h2>
        <p class="sub">회전오차가 이 값 이하면 OK 예요. 설정에서도 바꿀 수 있어요</p>
        <NumInput value={tolText} onInput={setTolText} placeholder="예: 2.0" unit="°" autoFocus />
        <div class="actions mt16">
          <button class="btn grey" onClick={() => setTolOpen(false)}>
            닫기
          </button>
          <button
            class="btn"
            disabled={parseNum(tolText) == null}
            onClick={() => {
              setSettings({ rotTol: Math.abs(parseNum(tolText)!) });
              setTolOpen(false);
            }}
          >
            저장
          </button>
        </div>
      </Sheet>
      {p.children}
    </div>
  );
}
