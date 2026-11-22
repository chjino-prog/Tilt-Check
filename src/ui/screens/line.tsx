// 일반 부재 측정 (추가 기능) : FRAME 방향 / LONGL. 방향 / 임의각 ψ
import { useEffect, useState } from 'preact/hooks';
import { thetaLine, type Dir } from '../../calc/angle';
import { calcDir, dirName, faHighSide, longlDev } from '../../calc/sign';
import { effectiveAngles } from '../../calc/basis';
import { fmt, lineVerdict, parseNum } from '../../calc/judge';
import { getBlock, newId, saveRecord, type Block } from '../../db/store';
import { go } from '../router';
import { useSettings } from '../../settings';
import { useWakeLock } from '../../sensor/tilt';
import { Cta, Headline, NumInput, RefNote, RefWarningSheet, Seg, TopBar, toast } from '../components/ui';
import { IWarn } from '../icons';
import { HeadCard, HighPicker, ReadingCard, devOf, useHead, useHighSide, useMeasure } from '../components/reading';
import { Gauge, LineFigure } from '../components/gauge';

type Mode = 'frame' | 'longl' | 'psi';

const SUB: Record<Mode, string> = {
  frame: '폰 긴 옆면을 FRAME(횡단) 방향 라인에 대요',
  longl: '폰 긴 옆면을 LONGL.(길이) 방향 라인에 대요',
  psi: 'FRAME 기준으로 ψ 만큼 돌아간 라인에 대요',
};

export function LineScreen(p: { blockId: string }) {
  const s = useSettings();
  const [block, setBlock] = useState<Block | null | undefined>(undefined);
  const [mode, setMode] = useState<Mode>('frame');
  const [psiText, setPsiText] = useState('');
  const [dir, setDir] = useState<Dir>(1);
  const [memo, setMemo] = useState('');
  const head = useHead();
  // LONGL. 은 F.A 처럼 작은 값이라 크기만 보면 반대로 기운 라인도 '양호'가 된다 → 높은 쪽까지 받는다
  const m = useMeasure(mode === 'longl' && !head.ok ? '먼저 폰 머리 방향을 확인해주세요' : null);
  const h = useHighSide(m, head);
  useWakeLock();

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

  const eff = effectiveAngles(block);
  if (!eff)
    return (
      <div class="screen">
        <TopBar title="다른 부재" backTo={'/block/' + block.id} />
        <Headline eyebrow={`${block.ship} 호선 · ${block.block}`} title="T.A · F.A 가 아직 없어요" sub="블록에 도면값을 넣거나, 현물 기준 부재에서 재주세요" />
        <Cta>
          <button class="btn" onClick={() => go(`/block/${block.id}/ref`, true)}>
            현물에서 재기
          </button>
        </Cta>
      </div>
    );

  const psi = parseNum(psiText);
  const normal = mode === 'frame' ? eff.ta : mode === 'longl' ? eff.fa : psi == null ? null : thetaLine(eff.ta, eff.fa, psi, calcDir(dir, eff.faDir));
  const refTag = eff.basis === 'ref' ? ' (현물)' : '';
  const label = mode === 'frame' ? 'FRAME 방향' : mode === 'longl' ? 'LONGL. 방향' : `임의각 ψ=${psi ?? ''}° ${dir === 1 ? '선수' : '선미'}`;
  const longl = mode === 'longl';
  const expectHigh = faHighSide(eff.faDir); // 정상이면 F.A 반대쪽이 높다
  const dev = longl ? (m.value == null || !(h.flat || h.high) ? null : longlDev(m.value, h.high, eff.faDir, eff.fa)) : devOf(m.value, normal, true);
  const reversed = longl && h.high != null && h.high !== expectHigh && eff.fa > 0.05;
  const needHead = longl && !m.manual && m.sensor.status === 'running' && !head.ok;
  const canSave = m.fixed != null && normal != null && isFinite(normal) && (!longl || h.ready);

  const save = async () => {
    if (!canSave) return;
    const d = longl ? longlDev(m.fixed!, h.high, eff.faDir, eff.fa) : Math.abs(m.fixed!) - Math.abs(normal!);
    await saveRecord({
      id: newId(),
      createdAt: Date.now(),
      blockId: block.id,
      ship: block.ship,
      block: block.block,
      ta: eff.ta,
      fa: eff.fa,
      faDir: eff.faDir,
      basis: eff.basis,
      mode: 'line',
      lineLabel: longl && (h.high || h.flat) ? `${label} · ${h.high ? dirName(h.high) + ' 높음' : '수평'}` : label,
      normal: normal!,
      meas: m.fixed!,
      dev: d,
      verdict: lineVerdict(d, s),
      memo: memo.trim(),
    });
    toast('기록을 저장했어요');
    setMemo('');
    m.reset();
  };

  return (
    <div class="screen">
      <TopBar title="다른 부재" backTo={'/block/' + block.id} />
      <Headline eyebrow={`${block.ship} 호선 · ${block.block}`} title="부재 라인에 폰을 대주세요" sub={SUB[mode]} />
      <div class="section" style={{ marginBottom: '14px' }}>
        <Seg<Mode>
          value={mode}
          onChange={(v) => {
            setMode(v);
            m.release();
          }}
          options={[
            { v: 'frame', label: 'FRAME' },
            { v: 'longl', label: 'LONGL.' },
            { v: 'psi', label: '임의각' },
          ]}
        />
        {mode === 'psi' && (
          <div class="two-col mt8">
            <NumInput value={psiText} onInput={setPsiText} placeholder="ψ" unit="°" />
            <Seg<Dir>
              value={dir}
              onChange={setDir}
              options={[
                { v: 1, label: '선수' },
                { v: -1, label: '선미' },
              ]}
            />
          </div>
        )}
        <div class="normal-pill num mt8">
          정상값 <b>{normal == null || !isFinite(normal) ? '—' : fmt(Math.abs(normal), 2) + '°'}</b>
          {longl && eff.fa > 0.05 && <b> · {dirName(expectHigh)} 쪽이 높음</b>}
          <span style={{ color: 'var(--text-3)', fontSize: '13px' }}>{mode === 'frame' ? '= T.A' + refTag : mode === 'longl' ? `= F.A ${dirName(eff.faDir)}` + refTag : refTag.trim()}</span>
        </div>
      </div>
      {mode === 'psi' && normal != null && isFinite(normal) && Math.abs(normal) < 3 && (
        <div class="banner">
          <IWarn />
          <div>
            <b>정상값이 작아 숫자만으로는 기운 방향을 못 가려요</b>
            <span class="muted">이 라인은 수평계 화살표로 어느 쪽이 높은지 꼭 같이 봐주세요</span>
          </div>
        </div>
      )}
      {longl && <HeadCard m={m} head={head} />}
      <ReadingCard m={m} normal={normal} compareAbs={true} normalLabel="편차" unsigned dev={longl ? dev : undefined} />
      {longl && <HighPicker m={m} h={h} head={head} />}
      {reversed && (
        <div class="alert bad">
          <IWarn />
          <div>
            <b>라인이 반대로 기울었어요</b>
            <span class="num">
              정상은 {dirName(expectHigh)} 쪽이 높아야 해요. 숫자만 비슷해 보여도 실제로는 {fmt(Math.abs(dev ?? 0), 2)}° 차이예요
            </span>
          </div>
        </div>
      )}
      <Gauge dev={dev} />
      {normal != null && isFinite(normal) && !reversed && <LineFigure normal={normal} meas={m.value} />}
      {m.fixed != null && (
        <div class="section mt16">
          <input class="input" type="text" value={memo} placeholder="메모 (선택)" onInput={(e) => setMemo((e.target as HTMLInputElement).value)} />
        </div>
      )}
      <RefNote />
      <RefWarningSheet />
      <Cta>
        {m.fixed == null ? (
          <button class="btn" disabled={m.manual || m.sensor.status !== 'running' || needHead} onClick={m.hold}>
            {m.manual ? '값을 입력해주세요' : needHead ? '폰 머리 방향을 먼저 확인해주세요' : '고정하기'}
          </button>
        ) : (
          <>
            {!m.manual && (
              <button class="btn grey" onClick={m.release}>
                다시
              </button>
            )}
            <button class="btn" disabled={!canSave} onClick={save}>
              {longl && !h.ready ? '높은 쪽을 골라주세요' : '기록 저장'}
            </button>
          </>
        )}
      </Cta>
    </div>
  );
}
