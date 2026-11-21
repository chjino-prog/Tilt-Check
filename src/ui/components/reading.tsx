// 실측값 카드 : 센서 값(또는 직접 입력) + 안정 표시 + HOLD(화면 탭)
import { useState } from 'preact/hooks';
import { tilt, useTilt, vibrate, type TiltState } from '../../sensor/tilt';
import { setSettings, useSettings } from '../../settings';
import { devLevel, fmt, fmtSigned, parseNum } from '../../calc/judge';
import type { Dir } from '../../calc/angle';
import { dirName, highFromPhone } from '../../calc/sign';
import { toast } from './ui';

export interface Measure {
  sensor: TiltState;
  manual: boolean;
  setManual: (b: boolean) => void;
  manualText: string;
  setManualText: (s: string) => void;
  held: number | null;
  /** 지금 화면에 보이는 값 (고정값 > 직접입력 > 실시간) */
  value: number | null;
  /** 저장 · 다음 단계로 갈 수 있는 확정값 */
  fixed: number | null;
  hold: () => void;
  release: () => void;
  reset: () => void;
}

export function useMeasure(): Measure {
  const sensor = useTilt();
  const [held, setHeld] = useState<number | null>(null);
  const [manualPick, setManual] = useState(false);
  const [manualText, setManualText] = useState('');
  const noSensor = sensor.status === 'unsupported' || sensor.status === 'denied';
  const manual = manualPick || noSensor;
  const manualVal = parseNum(manualText);
  const live = sensor.status === 'running' && !sensor.moving ? sensor.angle : null;
  const value = manual ? manualVal : held ?? live;
  const fixed = manual ? manualVal : held;

  const hold = () => {
    if (manual || held != null) return;
    if (sensor.status !== 'running' || sensor.angle == null) return;
    if (sensor.moving) return toast('움직이고 있어요. 폰을 부재에 대고 멈춰주세요');
    if (!sensor.stable) return toast('아직 흔들려요. 잠시 그대로 대주세요');
    setHeld(sensor.angle);
    vibrate(50);
  };
  const release = () => {
    setHeld(null);
    tilt.reset();
  };
  const reset = () => {
    setHeld(null);
    setManualText('');
    tilt.reset();
  };
  return { sensor, manual, setManual, manualText, setManualText, held, value, fixed, hold, release, reset };
}

export function devOf(value: number | null, normal: number | null, compareAbs: boolean): number | null {
  if (value == null || normal == null || !isFinite(normal)) return null;
  return compareAbs ? Math.abs(value) - Math.abs(normal) : value - normal;
}

/**
 * unsigned : 숫자만 받는다 (± 버튼을 숨기고 '-' 를 지움). 부호는 높은 쪽 선택으로 붙인다.
 * dev : 정상 대비 차이를 밖에서 계산해 넘길 때 (높은 쪽까지 반영한 값)
 */
export function ReadingCard(p: { m: Measure; normal: number | null; compareAbs: boolean; normalLabel?: string; unsigned?: boolean; dev?: number | null }) {
  const s = useSettings();
  const { m } = p;
  const st = m.sensor;
  const dev = p.dev !== undefined ? p.dev : devOf(m.value, p.normal, p.compareAbs);
  const lvl = devLevel(dev, s);
  const noSensor = st.status === 'unsupported' || st.status === 'denied';

  if (m.manual) {
    const neg = m.manualText.trim().startsWith('-') || m.manualText.trim().startsWith('−');
    const flip = () => {
      const t = m.manualText.trim().replace(/^[-−]/, '');
      m.setManualText(neg ? t : '-' + t);
    };
    return (
      <div>
        <div class="reading" style={{ cursor: 'default' }}>
          <div class="reading-head">
            <span>{noSensor ? '센서를 쓸 수 없어 직접 입력해요' : '직접 입력'}</span>
            {!noSensor && (
              <button class="text-btn" onClick={() => m.setManual(false)}>
                센서로 재기
              </button>
            )}
          </div>
          <div class="row-gap mt8">
            {!p.unsigned && (
              <button class="sign-btn" aria-label="부호 바꾸기" onClick={flip}>
                ±
              </button>
            )}
            <div class="input-wrap" style={{ flex: 1 }}>
              <input
                class="input num"
                style={{ height: '72px', fontSize: '34px', fontWeight: 700, textAlign: 'center' }}
                type="text"
                inputMode="decimal"
                placeholder="0.0"
                value={m.manualText}
                onInput={(e) => {
                  const t = (e.target as HTMLInputElement).value;
                  m.setManualText(p.unsigned ? t.replace(/[-−]/g, '') : t);
                }}
              />
              <span class="unit">°</span>
            </div>
          </div>
          <DevLine dev={dev} lvl={lvl} decimals={s.decimals} normalLabel={p.normalLabel} />
        </div>
      </div>
    );
  }

  if (st.status === 'need-permission') {
    return (
      <div class="reading center" style={{ cursor: 'default', padding: '28px 20px' }}>
        <div style={{ fontSize: '17px', fontWeight: 700 }}>기울기 센서를 켜주세요</div>
        <div class="note" style={{ marginTop: '6px' }}>
          처음 한 번만 허용하면 돼요
        </div>
        <button class="btn small mt16" onClick={() => tilt.requestPermission()}>
          센서 켜기
        </button>
        <div>
          <button class="text-btn grey mt8" onClick={() => m.setManual(true)}>
            직접 입력할게요
          </button>
        </div>
      </div>
    );
  }

  const held = m.held != null;
  const status = held
    ? { cls: 'held', t: '고정됨' }
    : st.status !== 'running'
      ? { cls: 'live', t: '센서 준비 중' }
      : st.moving
        ? { cls: 'moving', t: '움직임 감지' }
        : st.stable
          ? { cls: 'stable', t: '안정' }
          : { cls: 'live', t: '측정 중' };
  const v = m.value;
  const arrow = v == null ? '' : v > 0.05 ? '▲' : v < -0.05 ? '▼' : '';

  return (
    <div
      class={'reading' + (held ? ' held' : st.stable && !st.moving ? ' stable' : '')}
      onClick={() => (held ? m.release() : m.hold())}
      role="button"
      aria-label={held ? '고정 풀기' : '값 고정하기'}
    >
      <div class="reading-head">
        <span class={'status-dot ' + status.cls}>{status.t}</span>
        <button
          class="text-btn grey"
          onClick={(e) => {
            e.stopPropagation();
            m.setManual(true);
          }}
        >
          직접 입력
        </button>
      </div>
      <div class="big num">
        <span class="arrow" aria-hidden="true">
          {arrow}
        </span>
        <span class={'v' + (v == null ? ' idle' : '')}>{v == null ? '—' : fmt(Math.abs(v), s.decimals)}</span>
        <span class="deg">°</span>
      </div>
      <DevLine dev={dev} lvl={lvl} decimals={s.decimals} normalLabel={p.normalLabel} />
      <div class="reading-hint">
        {held ? '화면을 누르면 다시 재요' : st.moving ? '폰을 부재에 대고 멈춰주세요' : '안정되면 화면 아무 곳이나 눌러 고정해요'}
      </div>
    </div>
  );
}

function DevLine(p: { dev: number | null; lvl: string; decimals: number; normalLabel?: string }) {
  return (
    <div class="dev-line num">
      <span>{p.normalLabel ?? '정상 대비'}</span>
      <span class={'dv c-' + p.lvl}>{p.dev == null ? '—' : fmtSigned(p.dev, p.decimals) + '°'}</span>
    </div>
  );
}

// ── 높은 쪽 (B · LONGL. 라인) — 부호 대신 "어느 쪽이 높은지"만 받는다
export interface HighSide {
  high: Dir | null; // 결과 : 높은 쪽
  flat: boolean; // 거의 수평 (높은 쪽 필요 없음)
  ready: boolean; // 다음 단계로 갈 수 있는지
  picked: Dir | null;
  setPicked: (d: Dir) => void;
}

export function useHighSide(m: Measure, initial?: Dir | null): HighSide {
  const s = useSettings();
  const [picked, setPicked] = useState<Dir | null>(initial ?? null);
  const v = m.value;
  const flat = v != null && Math.abs(v) < 0.005;
  const high = v == null || flat ? null : m.manual ? picked : highFromPhone(v, s.headDir);
  return { high, flat, ready: v != null && (flat || high != null), picked, setPicked };
}

function DirSeg(p: { value: Dir | null; onChange: (d: Dir) => void }) {
  return (
    <div class="seg dir-seg">
      {([1, -1] as Dir[]).map((d) => (
        <button class={p.value === d ? 'on' : ''} onClick={() => p.onChange(d)}>
          {dirName(d)} 쪽
        </button>
      ))}
    </div>
  );
}

/** 센서 : 폰 머리가 향한 쪽을 고르면 높은 쪽은 앱이 정함 / 직접 입력 : 높은 쪽을 직접 고름 */
export function HighPicker(p: { m: Measure; h: HighSide }) {
  const s = useSettings();
  const { m, h } = p;
  if (!m.manual && m.sensor.status !== 'running') return null; // 센서 켜기 전에는 숨김
  if (m.manual) {
    return (
      <div class="high-pick">
        <div class="high-k">
          <span>어느 쪽이 높아요?</span>
          {h.flat && <em>수평이라 안 골라도 돼요</em>}
        </div>
        <DirSeg value={h.picked} onChange={h.setPicked} />
      </div>
    );
  }
  return (
    <div class="high-pick">
      <div class="high-k">
        <span>폰 머리(카메라 쪽)가 향한 쪽</span>
        <em>{h.high ? <><b>{dirName(h.high)} 쪽</b>이 높아요</> : h.flat ? '거의 수평이에요' : ''}</em>
      </div>
      <DirSeg value={s.headDir} onChange={(d) => setSettings({ headDir: d })} />
    </div>
  );
}
