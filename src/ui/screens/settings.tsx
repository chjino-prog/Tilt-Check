// 설정 · 영점 보정(반전법)
import { useEffect, useState } from 'preact/hooks';
import { fmtSigned, parseNum } from '../../calc/judge';
import { setSettings, useSettings, type Settings, type Theme } from '../../settings';
import { tilt, useTilt, useWakeLock, vibrate } from '../../sensor/tilt';
import { back, go } from '../router';
import { BrandBar, ConfirmSheet, Cta, Headline, NumInput, Seg, Sheet, Toggle, TopBar, toast } from '../components/ui';
import { IChevron, IWarnFill } from '../icons';

type NumKey = 'tol1' | 'tol2' | 'capTol' | 'aResidTol' | 'aSensMin';

const NUM_META: Record<NumKey, { label: string; sub: string; unit: string; step?: number }> = {
  tol1: { label: '일반 편차 1단계', sub: '편차가 이 값 이하면 녹색(양호)이에요', unit: '°' },
  tol2: { label: '일반 편차 2단계', sub: '1단계 초과 ~ 이 값 이하면 주황(주의), 넘으면 빨강이에요', unit: '°' },
  capTol: { label: '합격 허용오차', sub: '지주캡 A · B 편차가 이 값 이하면 OK, 넘으면 NG 예요. 역산 회전각이 이 값을 넘으면 ‘주의’로 알려요. 0.1° 단위', unit: '°', step: 0.1 },
  aResidTol: { label: 'A 잔차 경고', sub: 'A 잔차가 이 값을 넘으면 재측정을 권해요', unit: '°' },
  aSensMin: { label: 'A 민감도 하한', sub: 'dA 가 이 값보다 작으면 A 는 참고로만 봐요', unit: '°/°' },
};

function valText(s: Settings, k: NumKey): string {
  const v = s[k];
  return (k === 'aSensMin' ? '' : '±') + String(Number(v.toFixed(2))) + NUM_META[k].unit;
}

export function SettingsScreen() {
  const s = useSettings();
  const [edit, setEdit] = useState<NumKey | null>(null);
  const [text, setText] = useState('');

  useEffect(() => {
    if (edit) setText(s[edit] == null ? '' : String(s[edit]));
  }, [edit]);

  const val = parseNum(text);
  const meta = edit ? NUM_META[edit] : null;
  const ok = edit != null && val != null && (edit === 'capTol' ? Math.abs(val) >= 0.1 : val >= 0);

  const row = (k: NumKey) => (
    <button class="row compact" onClick={() => setEdit(k)}>
      <div class="body">
        <div class="t1" style={{ fontWeight: 500 }}>
          {NUM_META[k].label}
        </div>
      </div>
      <div class="tail">
        <span class="value num">
          {valText(s, k)}
        </span>
        <span class="chev">
          <IChevron />
        </span>
      </div>
    </button>
  );

  return (
    <div class="screen with-tab no-cta">
      <BrandBar />
      <Headline title="설정" />

      <div class="section-title">
        <span>판정 기준</span>
      </div>
      <div class="list">
        {row('capTol')}
        {row('aResidTol')}
        {row('aSensMin')}
        {row('tol1')}
        {row('tol2')}
      </div>

      <div class="divider" />
      <div class="section-title">
        <span>측정</span>
      </div>
      <div class="list">
        <button class="row compact" onClick={() => go('/settings/calibrate')}>
          <div class="body">
            <div class="t1" style={{ fontWeight: 500 }}>
              영점 보정
            </div>
            <div class="t2">평평한 곳에서 두 번 재고, ▲▼ 방향까지 확인해요</div>
          </div>
          <div class="tail">
            <span class="value num" style={s.offset == null ? { color: 'var(--orange)' } : undefined}>
              {s.offset == null ? '안 함' : fmtSigned(s.offset, 2) + '°'}
            </span>
            <span class="chev">
              <IChevron />
            </span>
          </div>
        </button>
        <button class="row compact" onClick={() => go('/settings/calibrate-face')}>
          <div class="body">
            <div class="t1" style={{ fontWeight: 500 }}>
              뒷면 보정
            </div>
            <div class="t2">FRAME 웹에 폰 뒷면을 붙여 잴 때 써요</div>
          </div>
          <div class="tail">
            <span class="value num" style={s.faceBias == null ? { color: 'var(--orange)' } : undefined}>
              {s.faceBias == null ? '안 함' : fmtSigned(faceBiasDeg(s.faceBias), 2) + '°'}
            </span>
            <span class="chev">
              <IChevron />
            </span>
          </div>
        </button>
        <div class="row compact">
          <div class="body">
            <div class="t1" style={{ fontWeight: 500 }}>
              표시 소수 자릿수
            </div>
          </div>
          <div style={{ width: '140px' }}>
            <Seg<1 | 2>
              value={s.decimals}
              onChange={(v) => setSettings({ decimals: v })}
              options={[
                { v: 1, label: '0.0' },
                { v: 2, label: '0.00' },
              ]}
            />
          </div>
        </div>
        <div class="row compact">
          <div class="body">
            <div class="t1" style={{ fontWeight: 500 }}>
              고정할 때 진동
            </div>
          </div>
          <Toggle label="진동" on={s.vibrate} onChange={(v) => setSettings({ vibrate: v })} />
        </div>
        <div class="row compact">
          <div class="body">
            <div class="t1" style={{ fontWeight: 500 }}>
              ▲▼ 방향 반대로
            </div>
            <div class="t2">영점 보정 3단계에서 저절로 정해져요</div>
          </div>
          <Toggle label="방향 반대로" on={s.flipSign} onChange={(v) => setSettings({ flipSign: v })} />
        </div>
      </div>

      <div class="divider" />
      <div class="section-title">
        <span>화면</span>
      </div>
      <div class="row compact">
        <div class="body">
          <div class="t1" style={{ fontWeight: 500 }}>
            테마
          </div>
        </div>
        <div style={{ width: '200px' }}>
          <Seg<Theme>
            value={s.theme}
            onChange={(v) => setSettings({ theme: v })}
            options={[
              { v: 'system', label: '자동' },
              { v: 'light', label: '밝게' },
              { v: 'dark', label: '어둡게' },
            ]}
          />
        </div>
      </div>

      <div class="divider" />
      <div class="section">
        <div class="note" style={{ marginTop: 0 }}>
          TILT CHECK {__APP_VERSION__}
          <br />
          모든 데이터는 이 폰 안에만 저장되고 밖으로 보내지 않아요. 앱을 지우거나 브라우저 데이터를 지우면 함께 지워지니, 기록은 CSV 로 내보내 보관해주세요.
          <br />
          폰 센서는 기기마다 0.1 ~ 0.5° 차이가 날 수 있어요. 판정은 디지털 수평계를 우선으로 쓰고, 폰 값은 참고로만 봐주세요.
        </div>
      </div>

      <Sheet open={edit != null} onClose={() => setEdit(null)}>
        {meta && (
          <>
            <h2>{meta.label}</h2>
            <p class="sub">{meta.sub}</p>
            <NumInput value={text} onInput={setText} placeholder="0.0" unit={meta.unit} autoFocus />
            <div class="actions mt16">
              <button class="btn grey" onClick={() => setEdit(null)}>
                닫기
              </button>
              <button
                class="btn"
                disabled={!ok}
                onClick={() => {
                  const v = Math.abs(val!);
                  setSettings({ [edit!]: meta!.step ? Number((Math.round(v / meta!.step) * meta!.step).toFixed(1)) : v } as Partial<Settings>);
                  setEdit(null);
                  toast('저장했어요');
                }}
              >
                저장
              </button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}

/**
 * 영점 보정(반전법) : m1 측정 → 폰 180° 돌려 같은 자리 m2 → offset = (m1 + m2) / 2
 * 3단계 : 카메라 쪽을 들어 ▲ 로 읽는지 확인 — 반대로 읽는 기기면 '▲▼ 방향 반대로'를 저절로 켠다.
 * (아이폰은 기종 이름으로 부호를 바로잡는데, 그게 틀린 기기도 여기서 잡힌다)
 */
export function CalibrateScreen() {
  const s = useSettings();
  const t = useTilt();
  useWakeLock();
  const [m1, setM1] = useState<number | null>(null);
  const [m2, setM2] = useState<number | null>(null);
  const [sawMove, setSawMove] = useState(false);
  const [dirSign, setDirSign] = useState<1 | -1 | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const step = m1 == null ? 1 : m2 == null ? 2 : 3;
  const ready = t.status === 'running' && t.stable && !t.moving && t.raw != null;
  const offset = m1 != null && m2 != null ? (m1 + m2) / 2 : null;
  const lifted = offset != null && t.raw != null ? t.raw - offset : null;

  // 2단계 : 폰을 실제로 들어 돌렸는지 (움직임이 한 번은 있어야 한다)
  useEffect(() => {
    if (step === 2 && !sawMove && (t.moving || (t.raw != null && m1 != null && Math.abs(t.raw - m1) > 3))) setSawMove(true);
  }, [step, t.moving, t.raw]);

  // 3단계 : 카메라 쪽을 3° 넘게 들고 멈추면 방향을 정한다
  useEffect(() => {
    if (step === 3 && dirSign == null && ready && lifted != null && Math.abs(lifted) >= 3) {
      setDirSign(lifted > 0 ? 1 : -1);
      vibrate(50);
    }
  }, [step, ready, lifted]);

  const restart = () => {
    setM1(null);
    setM2(null);
    setSawMove(false);
    setDirSign(null);
    tilt.reset();
  };

  const take = () => {
    if (!ready) return toast(t.moving ? '움직이고 있어요. 멈춰주세요' : '아직 흔들려요. 잠시 그대로 두세요');
    if (step === 2 && !sawMove) return toast('폰을 들어 180° 돌린 뒤 같은 자리에 대주세요');
    vibrate(50);
    if (step === 1) {
      setM1(t.raw);
      tilt.reset();
    } else setM2(t.raw);
  };

  const unavailable = t.status === 'unsupported' || t.status === 'denied';

  if (step === 3) {
    const big = offset != null && Math.abs(offset) > 2;
    return (
      <div class="screen">
        <TopBar title="영점 보정" backTo="/settings" />
        <div class="steps">
          <span class="on" />
          <span class="on" />
          <span class="on" />
        </div>
        <Headline
          eyebrow="3/3 · 방향 확인"
          title={
            <>
              카메라 쪽을
              <br />
              살짝 들어주세요
            </>
          }
          sub="이 폰이 높은 쪽을 바르게 읽는지 확인해요"
        />
        {dirSign == null ? (
          <div class="reading center" style={{ cursor: 'default' }}>
            <div class="reading-head">
              <span class={'status-dot ' + (t.moving ? 'moving' : 'live')}>{t.moving ? '움직임 감지' : '기다리는 중'}</span>
              <span>3° 넘게 들고 멈춰요</span>
            </div>
            <div class="big num">
              <span class="v">{lifted == null ? '—' : fmtSigned(lifted, 1)}</span>
              <span class="deg">°</span>
            </div>
          </div>
        ) : (
          <div class={'dir-check ' + (dirSign > 0 ? 'good' : 'warn')}>
            <div class="big num">{dirSign > 0 ? '▲' : '▼'}</div>
            <b>{dirSign > 0 ? '방향이 맞아요' : '이 폰은 방향을 반대로 읽어요'}</b>
            <span>{dirSign > 0 ? '카메라 쪽이 높을 때 ▲ 로 읽어요' : '보정을 적용하면 앱이 바로잡아서 ▲ 로 보여줘요'}</span>
          </div>
        )}
        <div class="section mt16">
          <div class="note num" style={{ marginTop: 0 }}>
            영점 보정값 {fmtSigned(offset, 2)}° · 첫 번째 {fmtSigned(m1, 2)}° · 두 번째 {fmtSigned(m2, 2)}°
          </div>
        </div>
        {big && (
          <div class="banner">
            <IWarnFill />
            <div>
              <b>보정값이 커요</b>
              <span class="muted">두 번 모두 같은 자리에 댔는지, 케이스가 걸리지 않았는지 확인해주세요</span>
            </div>
          </div>
        )}
        <Cta>
          <button class="btn grey" onClick={restart}>
            다시
          </button>
          <button
            class="btn"
            disabled={dirSign == null}
            onClick={() => {
              setSettings({ offset, flipSign: dirSign! < 0 });
              toast(dirSign! < 0 ? '방향을 바로잡고 보정을 마쳤어요' : '영점 보정을 마쳤어요');
              go('/settings', true);
            }}
          >
            {dirSign == null ? '카메라 쪽을 들어주세요' : '보정 적용'}
          </button>
        </Cta>
      </div>
    );
  }

  return (
    <div class="screen">
      <TopBar title="영점 보정" backTo="/settings" />
      <div class="steps">
        <span class="on" />
        <span class={step >= 2 ? 'on' : ''} />
        <span />
      </div>
      <Headline
        eyebrow={`${step}/3`}
        title={step === 1 ? '평평한 곳에 폰을 대주세요' : '폰을 180° 돌려 같은 자리에 대주세요'}
        sub={step === 1 ? '폰 긴 옆면을 대고 흔들리지 않게 잠시 기다려요' : '윗단과 아랫단이 바뀌도록 들어서 돌려, 처음과 같은 자리에 대요'}
      />
      {unavailable ? (
        <div class="section">
          <div class="card note" style={{ marginTop: 0 }}>
            이 기기에서는 기울기 센서를 쓸 수 없어요.
          </div>
        </div>
      ) : t.status === 'need-permission' ? (
        <div class="reading center" style={{ padding: '28px 20px', cursor: 'default' }}>
          <div style={{ fontSize: '17px', fontWeight: 700 }}>기울기 센서를 켜주세요</div>
          <button class="btn small mt16" onClick={() => tilt.requestPermission()}>
            센서 켜기
          </button>
        </div>
      ) : (
        <div class={'reading' + (ready ? ' stable' : '')} onClick={take} role="button">
          <div class="reading-head">
            <span class={'status-dot ' + (t.moving ? 'moving' : ready ? 'stable' : 'live')}>{t.moving ? '움직임 감지' : ready ? '안정' : '측정 중'}</span>
            <span>보정 전 값</span>
          </div>
          <div class="big num">
            <span class="arrow" />
            <span class={'v' + (t.raw == null ? ' idle' : '')}>{t.raw == null ? '—' : fmtSigned(t.raw, 2)}</span>
            <span class="deg">°</span>
          </div>
          <div class="reading-hint">안정되면 버튼이나 화면을 눌러 저장해요</div>
        </div>
      )}
      {s.offset != null && step === 1 && (
        <div class="center mt16">
          <button class="text-btn grey" onClick={() => setConfirmReset(true)}>
            지금 보정값 {fmtSigned(s.offset, 2)}° 초기화
          </button>
        </div>
      )}
      <Cta>
        <button class="btn" disabled={!ready || (step === 2 && !sawMove)} onClick={take}>
          {step === 1 ? '첫 번째 값 저장' : !sawMove ? '폰을 들어 돌려주세요' : '두 번째 값 저장'}
        </button>
      </Cta>
      <ConfirmSheet
        open={confirmReset}
        title="영점 보정값을 지울까요?"
        sub="보정 없이 센서 값을 그대로 써요."
        okLabel="초기화"
        onClose={() => setConfirmReset(false)}
        onOk={() => {
          setSettings({ offset: null });
          setConfirmReset(false);
          toast('보정값을 지웠어요');
        }}
      />
    </div>
  );
}

/** 뒷면 보정값(비율) → 각도로 본 크기 (°) */
export const faceBiasDeg = (b: number) => (Math.asin(Math.max(-1, Math.min(1, b))) * 180) / Math.PI;

/**
 * 뒷면 보정 : 화면 축 센서의 치우침을 잡는다 (판 기울기 재기용).
 * 1) 책상에 화면이 위로 → 2) 엎어서 화면이 아래로. 두 값의 가운데가 치우침이고,
 * 1) 이 2) 보다 커야 '화면이 하늘 = +' 다 (아니면 부호를 뒤집어 저장).
 */
export function FaceCalibrateScreen() {
  const t = useTilt();
  useWakeLock();
  const [up, setUp] = useState<number | null>(null);
  const [down, setDown] = useState<number | null>(null);
  const step = up == null ? 1 : down == null ? 2 : 3;
  const r = t.faceRaw;
  // 책상에 놓였는지 : 화면 축이 거의 중력 방향
  const flat = r != null && Math.abs(r) > 0.97;
  const flipped = r != null && up != null && Math.sign(r) !== Math.sign(up);
  const ready = t.status === 'running' && t.faceStable && !t.moving && flat && (step !== 2 || flipped);
  const unavailable = t.status === 'unsupported' || t.status === 'denied';

  const take = () => {
    if (!ready) {
      if (t.moving) return toast('움직이고 있어요. 멈춰주세요');
      if (!flat) return toast('책상 위에 평평하게 놓아주세요');
      if (step === 2 && !flipped) return toast('폰을 엎어서 화면이 아래로 가게 놓아주세요');
      return toast('아직 흔들려요. 잠시 그대로 두세요');
    }
    vibrate(50);
    if (step === 1) {
      setUp(r);
      tilt.reset();
    } else setDown(r);
  };

  if (step === 3) {
    const bias = (up! + down!) / 2;
    const sign: 1 | -1 = up! > down! ? 1 : -1;
    const big = Math.abs(faceBiasDeg(bias)) > 2;
    return (
      <div class="screen">
        <TopBar title="뒷면 보정" backTo="/settings" />
        <div class="steps">
          <span class="on" />
          <span class="on" />
        </div>
        <Headline eyebrow="완료" title="뒷면 보정값을 구했어요" sub="FRAME 웹에 폰 뒷면을 붙여 잴 때 이 값만큼 바로잡아요" />
        <div class="section">
          <div class="card">
            <div class="kv">
              <span class="k">보정값</span>
              <span class="v num">{fmtSigned(faceBiasDeg(bias), 2)}°</span>
            </div>
            <div class="kv">
              <span class="k">화면 방향</span>
              <span class="v">{sign > 0 ? '바르게 읽어요' : '반대로 읽어 바로잡아요'}</span>
            </div>
          </div>
        </div>
        {big && (
          <div class="banner">
            <IWarnFill />
            <div>
              <b>보정값이 커요</b>
              <span class="muted">두 번 모두 같은 자리 · 평평한 곳이었는지, 케이스가 걸리지 않았는지 확인해주세요</span>
            </div>
          </div>
        )}
        <Cta>
          <button
            class="btn grey"
            onClick={() => {
              setUp(null);
              setDown(null);
              tilt.reset();
            }}
          >
            다시
          </button>
          <button
            class="btn"
            onClick={() => {
              setSettings({ faceBias: bias, faceSign: sign });
              toast('뒷면 보정을 마쳤어요');
              back('/settings');
            }}
          >
            보정 적용
          </button>
        </Cta>
      </div>
    );
  }

  return (
    <div class="screen">
      <TopBar title="뒷면 보정" backTo="/settings" />
      <div class="steps">
        <span class="on" />
        <span class={step >= 2 ? 'on' : ''} />
      </div>
      <Headline
        eyebrow={`${step}/2`}
        title={step === 1 ? '책상에 화면이 위로 가게 놓아주세요' : '같은 자리에 엎어서 놓아주세요'}
        sub={step === 1 ? '케이스를 끼운 그대로, 평평한 곳에 놓고 기다려요' : '화면이 바닥을 보게 뒤집어요'}
      />
      {unavailable ? (
        <div class="section">
          <div class="card note" style={{ marginTop: 0 }}>
            이 기기에서는 기울기 센서를 쓸 수 없어요.
          </div>
        </div>
      ) : t.status === 'need-permission' ? (
        <div class="reading center" style={{ padding: '28px 20px', cursor: 'default' }}>
          <div style={{ fontSize: '17px', fontWeight: 700 }}>기울기 센서를 켜주세요</div>
          <button class="btn small mt16" onClick={() => tilt.requestPermission()}>
            센서 켜기
          </button>
        </div>
      ) : (
        <div class={'reading' + (ready ? ' stable' : '')} onClick={take} role="button">
          <div class="reading-head">
            <span class={'status-dot ' + (t.moving ? 'moving' : ready ? 'stable' : 'live')}>{t.moving ? '움직임 감지' : ready ? '안정' : flat ? '측정 중' : '평평하게 놓아주세요'}</span>
            <span>{r == null ? '' : r > 0 ? '화면이 위' : '화면이 아래'}</span>
          </div>
          <div class="big num">
            <span class="arrow" />
            <span class={'v' + (r == null ? ' idle' : '')}>{r == null ? '—' : Math.abs(faceBiasDeg(r)).toFixed(1)}</span>
            <span class="deg">°</span>
          </div>
          <div class="reading-hint">안정되면 버튼이나 화면을 눌러 저장해요</div>
        </div>
      )}
      <Cta>
        <button class="btn" disabled={!ready} onClick={take}>
          {step === 1 ? '첫 번째 값 저장' : '두 번째 값 저장'}
        </button>
      </Cta>
    </div>
  );
}
