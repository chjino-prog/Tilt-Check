// 지주캡 측정 : 정상값 → B 측정 → A 측정 → 결과(역산 · 잔차 · 판정)
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { analyzeCap, capNormal } from '../../calc/angle';
import { basisName, effectiveAngles, type Effective } from '../../calc/basis';
import { capDirText, capVerdict, fmt, fmtSigned, parseNum, verdictLevel } from '../../calc/judge';
import { deleteCap, getBlock, getCap, newId, saveRecord, type Block, type Cap } from '../../db/store';
import { setSettings, useSettings } from '../../settings';
import { useWakeLock } from '../../sensor/tilt';
import { back, go } from '../router';
import { ConfirmSheet, Cta, Headline, MenuRow, NumInput, RefNote, RefWarningSheet, Sheet, TopBar, toast } from '../components/ui';
import { ReadingCard, devOf, useMeasure } from '../components/reading';
import { Gauge, PlanFigure } from '../components/gauge';
import { IBack, ICamera, ICheck, IEdit, IImage, IInfo, IMinus, IMore, ITrash, IWarn, IX } from '../icons';
import { CapSheet } from './edit-sheets';
import { makePhoto } from './photo';

type Stage = 'ready' | 'B' | 'A' | 'result';

export function GuideSheet(p: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={p.open} onClose={p.onClose}>
      <h2>측정 위치</h2>
      <p class="sub">각도기 B는 ③ 상판, 각도기 A는 ① WEB 상단이에요</p>
      <img class="guide-img" src={`${import.meta.env.BASE_URL}cap-guide.png`} alt="지주캡 측정 위치 그림 — ① WEB, ③ 상판, 각도기 A · B 위치" />
      <div class="actions mt16">
        <button class="btn" onClick={p.onClose}>
          확인
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
  const [measB, setMeasB] = useState<number | null>(null);
  const [measA, setMeasA] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const [guide, setGuide] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const load = async () => {
    const [b, c] = await Promise.all([getBlock(p.blockId), getCap(p.capId)]);
    setBlock(b ?? null);
    setCap(c ?? null);
  };
  useEffect(() => {
    load();
  }, [p.blockId, p.capId]);

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
  const normal = capNormal(eff.ta, eff.fa, cap.delta, cap.dir);
  const dirText = capDirText(cap.delta, cap.dir);
  const aWeak = normal.dA < s.aSensMin;
  const title = `캡 ${cap.no}`;
  const stepBack = () => {
    if (stage === 'B') setStage('ready');
    else if (stage === 'A') setStage('B');
    else if (stage === 'result') setStage('A');
    else back('/block/' + block.id);
  };

  // 뒤로 버튼은 화면 밖이 아니라 이전 단계로
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
        <MenuRow icon={IImage} label="측정 위치 그림" onClick={() => (setMenu(false), setGuide(true))} />
        <MenuRow icon={IEdit} label="지주캡 수정" onClick={() => (setMenu(false), setEditing(true))} />
        <MenuRow icon={ITrash} label="지주캡 삭제" danger onClick={() => (setMenu(false), setConfirmDel(true))} />
      </Sheet>
      <GuideSheet open={guide} onClose={() => setGuide(false)} />
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
          toast('지주캡을 지웠어요');
          back('/block/' + block.id);
        }}
      />
    </>
  );

  if (stage === 'ready') {
    return (
      <div class="screen">
        {bar}
        <Headline
          eyebrow={`${block.ship} 호선 · ${block.block}`}
          title={title}
          sub={
            <span class="num">
              δ {fmt(cap.delta, 2)}°{dirText && ` · ${dirText} 쪽으로 돌아간 캡`}
            </span>
          }
        />
        <div class="section">
          <div class="card">
            <BasisLine eff={eff} />
            <div class="stat-grid">
              <div class="stat">
                <div class="k">정상 θB (상판)</div>
                <div class="v num">
                  {fmt(normal.thetaB, 2)}
                  <small>°</small>
                </div>
              </div>
              <div class={'stat' + (aWeak ? ' muted' : '')}>
                <div class="k">정상 θA (WEB)</div>
                <div class="v num">
                  {fmt(normal.thetaA, 2)}
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
          </div>
        </div>
        <div class="section-title">
          <span>이렇게 재요</span>
          <button class="text-btn" onClick={() => setGuide(true)}>
            그림 보기
          </button>
        </div>
        <div class="list">
          <div class="row compact">
            <div class="lead blue">1</div>
            <div class="body">
              <div class="t1">③ 상판 — 각도 B</div>
              <div class="t2">WEB 직각(LONGL.) 방향으로 대요</div>
            </div>
          </div>
          <div class="row compact">
            <div class="lead blue">2</div>
            <div class="body">
              <div class="t1">① WEB 상단 — 각도 A</div>
              <div class="t2">WEB 방향으로 대요</div>
            </div>
          </div>
        </div>
        <Cta>
          <button class="btn" onClick={() => setStage('B')}>
            측정 시작
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
        step={isB ? 1 : 2}
        eyebrow={isB ? '1/2 · 각도 B' : '2/2 · 각도 A'}
        title={isB ? '③ 상판에 폰을 대주세요' : '① WEB 상단에 폰을 대주세요'}
        sub={isB ? 'WEB 직각(LONGL.) 방향 · 폰 윗단을 F.A 높은 쪽으로' : 'WEB 방향 · 폰 윗단을 T.A 높은 쪽으로'}
        normalLabel={isB ? '정상 θB' : '정상 θA'}
        normal={isB ? normal.thetaB : normal.thetaA}
        initial={isB ? measB : measA}
        weak={!isB && aWeak}
        onGuide={() => setGuide(true)}
        onDone={(v) => {
          if (isB) {
            setMeasB(v);
            setStage('A');
          } else {
            setMeasA(v);
            setStage('result');
          }
        }}
      >
        {sheets}
      </StepScreen>
    );
  }

  return (
    <ResultScreen
      bar={bar}
      block={block}
      cap={cap}
      eff={eff}
      measA={measA!}
      measB={measB!}
      onRetry={() => {
        setMeasA(null);
        setMeasB(null);
        setStage('B');
      }}
    >
      {sheets}
    </ResultScreen>
  );
}

/** 정상값 카드 위 한 줄 : 어느 기준으로 계산했는지 */
function BasisLine(p: { eff: Effective }) {
  return (
    <div class="basis-line num">
      <span>
        {basisName(p.eff.basis)} 기준 · T.A {fmt(p.eff.ta, 2)}° · F.A {fmt(p.eff.fa, 2)}°
      </span>
      {p.eff.basis === 'ref' && <span class="badge blue">현물</span>}
    </div>
  );
}

function StepScreen(p: {
  bar: preact.JSX.Element;
  step: number;
  eyebrow: string;
  title: string;
  sub: string;
  normalLabel: string;
  normal: number;
  initial: number | null;
  weak: boolean;
  onGuide: () => void;
  onDone: (v: number) => void;
  children: preact.ComponentChildren;
}) {
  const m = useMeasure();
  useWakeLock();
  const dev = devOf(m.value, p.normal, false);
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
          {p.normalLabel} <b>{fmtSigned(p.normal, 2)}°</b>
        </span>
        <button class="text-btn" onClick={p.onGuide}>
          위치 그림
        </button>
      </div>
      {p.weak && (
        <div class="banner info">
          <IInfo />
          <div>
            <b>이 캡은 A로 회전을 판정하기 어려워요</b>
            <span class="muted">A 값은 참고로만 봐요</span>
          </div>
        </div>
      )}
      <ReadingCard m={m} normal={p.normal} compareAbs={false} normalLabel="정상 대비" />
      <Gauge dev={dev} />
      <RefNote />
      <div class="disclaimer">폰 케이스 · 카메라 돌출부 때문에 옆면이 뜨지 않게 대주세요</div>
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
              {p.step === 1 ? '다음' : '결과 보기'}
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
  measA: number;
  measB: number;
  onRetry: () => void;
  children: preact.ComponentChildren;
}) {
  const s = useSettings();
  const { block, cap, eff } = p;
  const r = useMemo(() => analyzeCap(eff.ta, eff.fa, cap.delta, cap.dir, p.measA, p.measB), [eff, cap, p.measA, p.measB]);
  const verdict = capVerdict(r.rotErr, s);
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
      id: newId(),
      createdAt: Date.now(),
      blockId: block.id,
      ship: block.ship,
      block: block.block,
      ta: eff.ta,
      fa: eff.fa,
      basis: eff.basis,
      mode: 'cap',
      capId: cap.id,
      capNo: cap.no,
      delta: cap.delta,
      dir: cap.dir,
      normalA: r.thetaA,
      normalB: r.thetaB,
      measA: p.measA,
      measB: p.measB,
      errA: r.errA,
      errB: r.errB,
      deltaReal: r.deltaReal,
      rotErr: r.rotErr,
      aResid: r.aResid,
      verdict,
      memo: memo.trim(),
      photo: photo ?? undefined,
    });
    toast('기록을 저장했어요');
    back('/block/' + block.id);
  };

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
              회전오차 · 실제 δ {fmt(r.deltaReal, d)}° (도면 {fmt(cap.delta, 2)}°)
            </p>
          </>
        )}
        {verdict === '기준미정' && (
          <button class="text-btn mt8" onClick={() => setTolOpen(true)}>
            허용 회전오차 정하기
          </button>
        )}
        {verdict === '판정불가' && <p>B 실측값과 폰 방향(▲▼)을 다시 확인해주세요</p>}
      </div>

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

      <PlanFigure delta={cap.delta} dir={cap.dir} deltaReal={r.deltaReal} />

      <div class="section mt16">
        <div class="card" style={{ padding: '10px 20px' }}>
          <div class="kv-group">
            <div class="kv">
              <span class="k">계산 기준</span>
              <span class="v num">
                {basisName(eff.basis)} · T.A {fmt(eff.ta, 2)}° · F.A {fmt(eff.fa, 2)}°
              </span>
            </div>
          </div>
          <div class="kv-group">
            <div class="kv">
              <span class="k">각도 B 실측</span>
              <span class="v num">{fmtSigned(p.measB, d)}°</span>
            </div>
            <div class="kv">
              <span class="k">정상 θB</span>
              <span class="v num">{fmtSigned(r.thetaB, d)}°</span>
            </div>
            <div class="kv">
              <span class="k">B 각도오차</span>
              <span class="v num">{fmtSigned(r.errB, d)}°</span>
            </div>
          </div>
          <div class="kv-group">
            <div class="kv">
              <span class="k">각도 A 실측{aWeak ? ' (참고)' : ''}</span>
              <span class="v num">{fmtSigned(p.measA, d)}°</span>
            </div>
            <div class="kv">
              <span class="k">정상 θA</span>
              <span class="v num">{fmtSigned(r.thetaA, d)}°</span>
            </div>
            <div class="kv">
              <span class="k">A 각도오차</span>
              <span class="v num">{fmtSigned(r.errA, d)}°</span>
            </div>
            <div class="kv">
              <span class="k">A 예측 (실제 δ 기준)</span>
              <span class="v num">{fmtSigned(r.aPred, d)}°</span>
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
