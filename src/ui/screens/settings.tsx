// 설정 · 영점 보정(반전법)
import { useEffect, useState } from 'preact/hooks';
import { fmtSigned, parseNum } from '../../calc/judge';
import { setSettings, useSettings, type Settings, type Theme } from '../../settings';
import { tilt, useTilt, useWakeLock, vibrate } from '../../sensor/tilt';
import { go } from '../router';
import { BrandBar, ConfirmSheet, Cta, Headline, NumInput, Seg, Sheet, Toggle, TopBar, toast } from '../components/ui';
import { ICheck, IChevron } from '../icons';

type NumKey = 'tol1' | 'tol2' | 'rotTol' | 'aResidTol' | 'aSensMin';

const NUM_META: Record<NumKey, { label: string; sub: string; unit: string; allowEmpty?: boolean }> = {
  tol1: { label: '일반 편차 1단계', sub: '편차가 이 값 이하면 녹색(양호)이에요', unit: '°' },
  tol2: { label: '일반 편차 2단계', sub: '1단계 초과 ~ 이 값 이하면 주황(주의), 넘으면 빨강이에요', unit: '°' },
  rotTol: { label: '허용 회전오차', sub: '지주캡 OK / NG 판정 기준이에요. 비워두면 ‘기준미정’으로 표시해요', unit: '°', allowEmpty: true },
  aResidTol: { label: 'A 잔차 경고', sub: 'A 잔차가 이 값을 넘으면 재측정을 권해요', unit: '°' },
  aSensMin: { label: 'A 민감도 하한', sub: 'dA 가 이 값보다 작으면 A 는 참고로만 봐요', unit: '°/°' },
};

function valText(s: Settings, k: NumKey): string {
  const v = s[k];
  if (v == null) return '기준미정';
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
  const ok = edit != null && ((meta!.allowEmpty && text.trim() === '') || (val != null && val >= 0));

  const row = (k: NumKey) => (
    <button class="row compact" onClick={() => setEdit(k)}>
      <div class="body">
        <div class="t1" style={{ fontWeight: 500 }}>
          {NUM_META[k].label}
        </div>
      </div>
      <div class="tail">
        <span class="value num" style={k === 'rotTol' && s.rotTol == null ? { color: 'var(--text-3)' } : undefined}>
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
        {row('rotTol')}
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
            <div class="t2">평평한 곳에서 폰을 뒤집어 두 번 재요</div>
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
            <div class="t2">폰 윗단이 높은데 ▼ 가 보이면 켜요</div>
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
          폰 센서는 기기마다 0.1 ~ 0.5° 차이가 날 수 있어요. 참고용이며 최종 판정은 디지털 각도기로 해주세요.
        </div>
      </div>

      <Sheet open={edit != null} onClose={() => setEdit(null)}>
        {meta && (
          <>
            <h2>{meta.label}</h2>
            <p class="sub">{meta.sub}</p>
            <NumInput value={text} onInput={setText} placeholder={meta.allowEmpty ? '비워두면 기준미정' : '0.0'} unit={meta.unit} autoFocus />
            <div class="actions mt16">
              <button class="btn grey" onClick={() => setEdit(null)}>
                닫기
              </button>
              <button
                class="btn"
                disabled={!ok}
                onClick={() => {
                  setSettings({ [edit!]: text.trim() === '' ? null : Math.abs(val!) } as Partial<Settings>);
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

/** 영점 보정(반전법) : m1 측정 → 폰 180° 돌려 같은 자리 m2 → offset = (m1 + m2) / 2 */
export function CalibrateScreen() {
  const s = useSettings();
  const t = useTilt();
  useWakeLock();
  const [m1, setM1] = useState<number | null>(null);
  const [m2, setM2] = useState<number | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const step = m1 == null ? 1 : m2 == null ? 2 : 3;
  const ready = t.status === 'running' && t.stable && !t.moving && t.raw != null;

  const take = () => {
    if (!ready) return toast(t.moving ? '움직이고 있어요. 멈춰주세요' : '아직 흔들려요. 잠시 그대로 두세요');
    vibrate(50);
    if (step === 1) {
      setM1(t.raw);
      tilt.reset();
    } else setM2(t.raw);
  };

  if (step === 3) {
    const offset = (m1! + m2!) / 2;
    return (
      <div class="screen">
        <TopBar title="영점 보정" backTo="/settings" />
        <div class="result-hero" style={{ paddingTop: '40px' }}>
          <div class="mark good">
            <ICheck />
          </div>
          <h1>이 값으로 보정할게요</h1>
          <div class="rot num">{fmtSigned(offset, 2)}°</div>
          <p class="num">
            첫 번째 {fmtSigned(m1, 2)}° · 두 번째 {fmtSigned(m2, 2)}°
          </p>
        </div>
        {Math.abs(offset) > 2 && (
          <div class="banner">
            <div>
              <b>보정값이 커요</b>
              <span class="muted">두 번 모두 같은 자리에 댔는지, 케이스가 걸리지 않았는지 확인해주세요</span>
            </div>
          </div>
        )}
        <Cta>
          <button
            class="btn grey"
            onClick={() => {
              setM1(null);
              setM2(null);
              tilt.reset();
            }}
          >
            다시
          </button>
          <button
            class="btn"
            onClick={() => {
              setSettings({ offset });
              toast('영점 보정을 마쳤어요');
              go('/settings', true);
            }}
          >
            보정 적용
          </button>
        </Cta>
      </div>
    );
  }

  const unavailable = t.status === 'unsupported' || t.status === 'denied';
  return (
    <div class="screen">
      <TopBar title="영점 보정" backTo="/settings" />
      <div class="steps">
        <span class="on" />
        <span class={step >= 2 ? 'on' : ''} />
      </div>
      <Headline
        eyebrow={`${step}/2`}
        title={step === 1 ? '평평한 곳에 폰을 대주세요' : '폰을 180° 돌려 같은 자리에 대주세요'}
        sub={step === 1 ? '폰 긴 옆면을 대고 흔들리지 않게 잠시 기다려요' : '윗단과 아랫단이 바뀌도록 돌려서, 처음과 같은 자리에 대요'}
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
        <button class="btn" disabled={!ready} onClick={take}>
          {step === 1 ? '첫 번째 값 저장' : '두 번째 값 저장'}
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
