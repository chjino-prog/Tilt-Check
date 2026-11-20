// 일반 부재 측정 (추가 기능) : FRAME 방향 / LONGL. 방향 / 임의각 ψ
import { useEffect, useState } from 'preact/hooks';
import { thetaLine, type Dir } from '../../calc/angle';
import { effectiveAngles } from '../../calc/basis';
import { fmt, lineVerdict, parseNum } from '../../calc/judge';
import { getBlock, newId, saveRecord, type Block } from '../../db/store';
import { go } from '../router';
import { useSettings } from '../../settings';
import { useWakeLock } from '../../sensor/tilt';
import { Cta, Headline, NumInput, RefNote, RefWarningSheet, Seg, TopBar, toast } from '../components/ui';
import { ReadingCard, devOf, useMeasure } from '../components/reading';
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
  const m = useMeasure();
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
  const normal = mode === 'frame' ? eff.ta : mode === 'longl' ? eff.fa : psi == null ? null : thetaLine(eff.ta, eff.fa, psi, dir);
  const refTag = eff.basis === 'ref' ? ' (현물)' : '';
  const label = mode === 'frame' ? 'FRAME 방향' : mode === 'longl' ? 'LONGL. 방향' : `임의각 ψ=${psi ?? ''}° ${dir === 1 ? '선수' : '선미'}`;
  const dev = devOf(m.value, normal, true);
  const canSave = m.fixed != null && normal != null && isFinite(normal);

  const save = async () => {
    if (!canSave) return;
    const d = Math.abs(m.fixed!) - Math.abs(normal!);
    await saveRecord({
      id: newId(),
      createdAt: Date.now(),
      blockId: block.id,
      ship: block.ship,
      block: block.block,
      ta: eff.ta,
      fa: eff.fa,
      basis: eff.basis,
      mode: 'line',
      lineLabel: label,
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
          정상값 <b>{normal == null || !isFinite(normal) ? '—' : fmt(normal, 2) + '°'}</b>
          <span style={{ color: 'var(--text-3)', fontSize: '13px' }}>{mode === 'frame' ? '= T.A' + refTag : mode === 'longl' ? '= F.A' + refTag : refTag.trim()}</span>
        </div>
      </div>
      <ReadingCard m={m} normal={normal} compareAbs={true} normalLabel="편차" />
      <Gauge dev={dev} />
      {normal != null && isFinite(normal) && <LineFigure normal={normal} meas={m.value} />}
      {m.fixed != null && (
        <div class="section mt16">
          <input class="input" type="text" value={memo} placeholder="메모 (선택)" onInput={(e) => setMemo((e.target as HTMLInputElement).value)} />
        </div>
      )}
      <RefNote />
      <RefWarningSheet />
      <Cta>
        {m.fixed == null ? (
          <button class="btn" disabled={m.manual || m.sensor.status !== 'running'} onClick={m.hold}>
            {m.manual ? '값을 입력해주세요' : '고정하기'}
          </button>
        ) : (
          <>
            {!m.manual && (
              <button class="btn grey" onClick={m.release}>
                다시
              </button>
            )}
            <button class="btn" disabled={!canSave} onClick={save}>
              기록 저장
            </button>
          </>
        )}
      </Cta>
    </div>
  );
}
