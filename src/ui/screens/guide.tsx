// 설명서 탭 : 용어(A · B · δ · θ · T.A · F.A) · 지주캡 재는 순서 · 꼭 지킬 것
// 글은 docs/사용설명서.md · docs/계산식.md 와 같은 내용만 쓴다. 그림 속 숫자는 지어낸 예시값.
import type { ComponentChildren, JSX } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { go } from '../router';
import { BrandBar, Cta, Headline, Sheet, TopBar } from '../components/ui';
import { IChevron, IWarnFill } from '../icons';

const IMG = `${import.meta.env.BASE_URL}cap-guide.webp`;

type TermKey = 'A' | 'B' | 'delta' | 'theta' | 'TA' | 'FA';

/* ── 그림 */

/** 측정 방향 그림(cap-guide.webp)의 TS 칸 하나 */
function CapCrop(p: { kind: 'a' | 'b'; label: string }) {
  return <div class={'gd-crop ' + (p.kind === 'a' ? 'ts-ta' : 'ts-fa')} role="img" aria-label={p.label} style={{ backgroundImage: `url(${IMG})` }} />;
}

/** LIFTING LUG 도면의 '캡취부각도' 상자 */
function DeltaFig() {
  return (
    <svg class="dwg" viewBox="0 0 320 210" role="img" aria-label="캡취부각도 상자 예시. FR 선과 캡 중심선 사이 각이 δ, 양 끝 (미) (수) 표시가 선미 선수">
      <rect class="ln" x="16" y="6" width="288" height="198" stroke-width="1.2" />
      <text x="160" y="27" font-size="13" text-anchor="middle">캡취부각도</text>
      <line class="ln" x1="128" y1="31" x2="192" y2="31" stroke-width="1" />
      <line class="ln" x1="46" y1="62" x2="280" y2="104" stroke-width="3" />
      <text x="30" y="56" font-size="12">(미)</text>
      <text x="264" y="94" font-size="12">(수)</text>
      <text class="t-b" x="42" y="78" font-size="11" text-anchor="middle">선미</text>
      <text class="t-b" x="276" y="120" font-size="11" text-anchor="middle">선수</text>
      <line class="ln" x1="165" y1="83" x2="165" y2="184" stroke-width="3" />
      <text x="165" y="198" font-size="12" text-anchor="middle">FR</text>
      <g transform="rotate(12 165 130)">
        <line class="hl" x1="165" y1="88" x2="165" y2="178" stroke-width="1.6" stroke-dasharray="7 3 2 3" />
        <rect class="faint" x="150" y="104" width="30" height="46" stroke-width="1.2" stroke-dasharray="4 3" />
      </g>
      <path class="hl" d="M165 172 A42 42 0 0 1 156.3 171.1" stroke-width="2" />
      <circle class="bubble" cx="132" cy="168" r="13" stroke-width="1.6" />
      <text class="t-hl" x="132" y="173" font-size="14" text-anchor="middle">δ</text>
      <text class="t-hl" x="196" y="160" font-size="11">캡 중심선</text>
    </svg>
  );
}

/** LIFTING LUG 도면의 FR 단면도 — 캡 자리 외판 접선과 수평선 사이 θ */
function ThetaFig() {
  return (
    <svg class="dwg" viewBox="0 0 320 210" role="img" aria-label="FR 단면도 예시. 캡이 붙은 점에서 외판 접선과 A/B 기준 수평선 사이 각이 θ">
      <text x="200" y="22" font-size="15" font-weight="700" text-anchor="middle">FR.○○ SEC.</text>
      <line class="ln" x1="150" y1="26" x2="250" y2="26" stroke-width="1.2" />
      <line class="ln" x1="70" y1="52" x2="300" y2="52" stroke-width="1.6" />
      <line class="ln" x1="128" y1="146" x2="300" y2="146" stroke-width="1.2" />
      <line class="ln" x1="210" y1="52" x2="210" y2="184" stroke-width="1.2" />
      <line class="ln" x1="300" y1="52" x2="300" y2="184" stroke-width="1.2" />
      <path class="ln" d="M70 52 C 92 118, 150 166, 240 184 L 300 184" stroke-width="2.6" />
      <circle class="fill-ink" cx="276" cy="44" r="5" />
      <text x="276" y="32" font-size="11" text-anchor="middle">(A)</text>
      <line class="hl-b" x1="99.4" y1="106.2" x2="236" y2="106.2" stroke-width="1.8" stroke-dasharray="6 4" />
      <text class="t-b" x="236" y="100" font-size="11" text-anchor="end">수평 (A/B 기준선과 평행)</text>
      <line class="hl" x1="65.1" y1="63.2" x2="143.1" y2="160.9" stroke-width="2" />
      <text class="t-hl" x="58" y="72" font-size="11" text-anchor="end">외판 접선</text>
      <path class="hl" d="M137.4 106.2 A38 38 0 0 1 123.1 135.9" stroke-width="2.2" />
      <circle class="bubble" cx="152" cy="128" r="12" stroke-width="1.6" />
      <text class="t-hl" x="152" y="133" font-size="14" text-anchor="middle">θ</text>
      <rect class="fill-ink" x="96" y="96" width="14" height="8" rx="1.5" transform="rotate(-38.6 99.4 106.2)" />
      <circle class="ln" cx="99.4" cy="106.2" r="11" stroke-width="1.2" stroke-dasharray="3 2" />
      <line class="ln" x1="90" y1="114" x2="44" y2="150" stroke-width="1" />
      <text x="10" y="164" font-size="12" font-weight="700">캡 위치 (PSA)</text>
    </svg>
  );
}

/** 외판 PIN JIG 도면의 'TRANSVERSE ANGLE' 칸 */
function TaFig() {
  return (
    <svg class="dwg" viewBox="0 0 320 210" role="img" aria-label="TRANSVERSE ANGLE 칸 예시. 바닥 수평선과 기운 선 사이 각의 숫자가 T.A">
      <rect class="ln" x="16" y="6" width="288" height="198" stroke-width="1.2" />
      <line class="ln" x1="16" y1="40" x2="304" y2="40" stroke-width="1.2" />
      <text x="160" y="29" font-size="14" text-anchor="middle">TRANSVERSE ANGLE</text>
      <line class="ln" x1="34" y1="184" x2="290" y2="184" stroke-width="1.6" />
      <path class="ln" d="M100 184 Q 142 142, 168 54" stroke-width="1.6" />
      <path class="ln" d="M114 184 Q 156 142, 182 54" stroke-width="1.6" />
      <path class="hl-b" d="M168 184 A68 68 0 0 0 148.1 135.9" stroke-width="2" />
      <polygon class="fill-b" points="168,184 163,174 173,174" />
      <polygon class="fill-b" points="148.1,135.9 157.9,140 151.5,147" />
      <rect class="bubble-b" x="186" y="120" width="70" height="30" rx="8" stroke-width="1.6" />
      <text class="t-b" x="221" y="141" font-size="17" text-anchor="middle">45.00</text>
      <text class="t-b" x="221" y="168" font-size="11" text-anchor="middle">이 숫자 = T.A</text>
    </svg>
  );
}

/** 외판 PIN JIG 도면의 'FRAME ANGLE' 칸 */
function FaFig() {
  return (
    <svg class="dwg" viewBox="0 0 320 210" role="img" aria-label="FRAME ANGLE 칸 예시. 연직선과 FR 선 사이 각의 숫자가 F.A, FWD 표시로 FRAME 이 누운 쪽을 본다">
      <rect class="ln" x="16" y="6" width="288" height="198" stroke-width="1.2" />
      <line class="ln" x1="16" y1="40" x2="304" y2="40" stroke-width="1.2" />
      <text x="160" y="29" font-size="14" text-anchor="middle">FRAME ANGLE</text>
      <line class="faint" x1="150" y1="186" x2="150" y2="58" stroke-width="1.4" stroke-dasharray="5 4" />
      <text class="t-dim" x="156" y="66" font-size="10">연직</text>
      <line class="ln" x1="150" y1="186" x2="118" y2="58" stroke-width="2.6" />
      <text x="112" y="54" font-size="13" font-weight="700" text-anchor="middle">FR</text>
      <path class="hl-b" d="M150 96 A90 90 0 0 0 128.2 98.7" stroke-width="2" />
      <rect class="bubble-b" x="34" y="84" width="66" height="30" rx="8" stroke-width="1.6" />
      <text class="t-b" x="67" y="105" font-size="17" text-anchor="middle">10.00</text>
      <text class="t-b" x="67" y="128" font-size="11" text-anchor="middle">이 숫자 = F.A</text>
      <path class="hl" d="M132 70 Q 112 66, 96 74" stroke-width="2" />
      <polygon class="fill-hl" points="92,76 101,69 101,79" />
      <text class="t-hl" x="180" y="120" font-size="12">FR 윗부분이 간 쪽</text>
      <text class="t-hl" x="180" y="136" font-size="12">= FRAME 이 누운 쪽</text>
      <text class="t-dim" x="180" y="152" font-size="11">이 그림은 선미로 누움</text>
      <line class="ln" x1="210" y1="186" x2="272" y2="186" stroke-width="1.6" />
      <polygon class="fill-ink" points="280,186 270,181 270,191" />
      <text x="240" y="180" font-size="12" font-weight="700" text-anchor="middle">FWD</text>
    </svg>
  );
}

/* ── 용어 */

interface Term {
  key: TermKey;
  lead: string;
  leadCls: string; // 목록 왼쪽 글자 칸 꾸밈
  name: string; // 목록 · 시트 제목
  line: string; // 목록 한 줄 설명
  eyebrow: string;
  sub: string;
  fig: () => JSX.Element;
  figNote: string;
  rows: [string, ComponentChildren][];
  warn: ComponentChildren;
  rel: TermKey[];
}

const TERMS: Term[] = [
  {
    key: 'A',
    lead: 'A',
    leadCls: 'blue',
    name: '각도 A · WEB 방향',
    line: '배의 폭 방향 · WEB 과 평행',
    eyebrow: '용어 · 현장에서 재요',
    sub: '캡 주판 위에서 WEB 과 평행하게 잰 기울기예요. 배로 치면 폭 방향(FRAME 방향)이에요.',
    fig: () => (
      <>
        <CapCrop kind="a" label="TS 캡 각도 A : 4번 주판 위, 1번 부재와 평행하게 수평계를 댄 그림" />
        <span class="tag a">TS · ④ 주판 / ① 과 평행</span>
      </>
    ),
    figNote: '수평계 밑면 · 화살표 · 점선은 기준 부재 밑변과 평행',
    rows: [
      ['방향', '배의 폭 방향 · FRAME 방향'],
      ['넣는 것', <>숫자만<small>어느 쪽으로 대도 같아요</small></>],
      ['재는 곳', <>주판 위, WEB 과 평행<small>TS = ④ 주판 · ① 과 평행 / PSA = ③ 주판 · ①② 와 평행</small></>],
      ['쓰는 곳', <>정상 A 와 비교해 판정<small>캡 · F.A 방향을 바로 넣었는지 점검에도 써요</small></>],
    ],
    warn: <>A 는 캡이 돌아도 거의 안 바뀌어요. 반대 방향 정상값에 더 가까우면 방향을 잘못 넣은 것으로 보고 <b>판정을 보류</b>해요.</>,
    rel: ['B', 'TA'],
  },
  {
    key: 'B',
    lead: 'B',
    leadCls: 'orange',
    name: '각도 B · WEB 직각',
    line: '배의 선수미 방향 · 브라켓과 평행',
    eyebrow: '용어 · 현장에서 재요',
    sub: '캡 주판 위에서 브라켓과 평행하게 잰 기울기예요. 배로 치면 선수미 방향(LONGL. 방향)이에요.',
    fig: () => (
      <>
        <CapCrop kind="b" label="TS 캡 각도 B : 4번 주판 위, 2·3번 부재와 평행하게 수평계를 댄 그림" />
        <span class="tag b">TS · ④ 주판 / ②③ 과 평행</span>
      </>
    ),
    figNote: '수평계 밑면 · 화살표 · 점선은 기준 부재 밑변과 평행',
    rows: [
      ['방향', '배의 선수미 방향 · LONGL. 방향'],
      ['넣는 것', '숫자 + 높은 쪽 (선수 / 선미)'],
      ['재는 곳', <>주판 위, 브라켓과 평행<small>TS = ④ 주판 · ②③ 과 평행 / PSA = ③ 주판 · ④⑤ 와 평행</small></>],
      ['쓰는 곳', <>정상 B 와 비교해 판정<small>역산 회전오차(참고)도 B 로 계산해요</small></>],
    ],
    warn: <>폰 머리(카메라 쪽)를 <b>선수</b>로 대고 잴 때마다 확인 버튼을 눌러요. 높은 쪽을 반대로 고르면 판정이 뒤집혀요.</>,
    rel: ['A', 'FA'],
  },
  {
    key: 'delta',
    lead: 'δ',
    leadCls: 'sym',
    name: 'δ · 캡 취부각도',
    line: 'LIFTING LUG 도면 · FR 선과 틀어진 각',
    eyebrow: '용어 · LIFTING LUG 도면에서 봐요',
    sub: '외판을 정면에서 본 그림에서 FR 선과 캡 중심선 사이 각이에요.',
    fig: DeltaFig,
    figNote: '도면 예시 그림 · 기울기는 알아보기 쉽게 키웠어요',
    rows: [
      ['보는 곳', <>LIFTING LUG 도면<small>캡이 있는 단면도 옆 ‘캡취부각도’ 상자</small></>],
      ['넣는 것', <>숫자 + 돌아간 방향 (선수 / 선미)<small>돌아간 방향 = 캡 WEB 의 외판 쪽 끝이 가는 쪽</small></>],
      ['0 인 캡', '각도가 없는 캡(TS 캡 등)은 0, 방향은 안 넣어요'],
    ],
    warn: <>δ 는 외판 위에서 본 각이라 캡 상판에서는 더 돌아가 있어요. 그래서 외판 기울기 <b>θ</b> 를 같이 넣어요.</>,
    rel: ['theta', 'B'],
  },
  {
    key: 'theta',
    lead: 'θ',
    leadCls: 'sym',
    name: 'θ · 캡 자리 외판 기울기',
    line: 'LIFTING LUG 도면 · 외판이 선 각도',
    eyebrow: '용어 · LIFTING LUG 도면에서 봐요',
    sub: '캡이 붙은 점에서 외판 선이 수평선과 이루는 각이에요.',
    fig: ThetaFig,
    figNote: '도면 예시 그림 · 호선 · 블록 값은 넣지 않았어요',
    rows: [
      ['보는 곳', <>LIFTING LUG 도면<small>캡 표시가 있는 FR 단면도(SEC.)에서, 캡이 붙은 점의 외판 선에 자를 대고 수평선과의 각</small></>],
      ['넣는 것', <>0 ~ 90° 숫자, 1° 단위면 충분해요<small>누운 외판 0° · 벽처럼 선 외판 90° · 보는 방향 상관없음</small></>],
      ['왜', <>외판이 설수록 캡 상판은 더 돌아가 있어요<small>45° 면 약 1.4배, 60° 면 2배</small></>],
    ],
    warn: <>모르면 비워 두고 재요. 나중에 캡에 θ 를 넣으면 그 캡 기록을 <b>다시 계산</b>해요.</>,
    rel: ['delta'],
  },
  {
    key: 'TA',
    lead: 'T.A',
    leadCls: 'abbr',
    name: 'T.A · TRANSVERSE ANGLE',
    line: '외판 PIN JIG 도면 · 폭 방향으로 기운 각',
    eyebrow: '용어 · 외판 PIN JIG 도면에서 봐요',
    sub: '블록 단면에서 FRAME 방향 선이 수평에서 기운 각이에요.',
    fig: TaFig,
    figNote: '도면 예시 그림 · 45.00 은 지어낸 값이에요',
    rows: [
      ['보는 곳', <>외판 PIN JIG 도면<small>‘TRANSVERSE ANGLE’ 칸의 숫자</small></>],
      ['넣는 것', <>숫자만, 적힌 그대로<small>앱이 F.A 만큼 덜 가파른 경사로 바꿔 계산해요 (45° · F.A 10° → 약 44.1°)</small></>],
      ['현물', 'DECK · FLAT · STRINGER 상면의 FRAME 방향 선에 폰을 세워 대요'],
    ],
    warn: <>BASE 로 깐 판 위는 일부러 평평하게 깔아서 어디를 재도 0° 근처예요. 거기서 재면 안 돼요.</>,
    rel: ['FA', 'A'],
  },
  {
    key: 'FA',
    lead: 'F.A',
    leadCls: 'abbr',
    name: 'F.A · FRAME ANGLE',
    line: '외판 PIN JIG 도면 · FRAME 이 누운 각',
    eyebrow: '용어 · 외판 PIN JIG 도면에서 봐요',
    sub: 'FRAME 이 선수나 선미 쪽으로 누운 각이에요.',
    fig: FaFig,
    figNote: '도면 예시 그림 · 10.00 은 지어낸 값, 기울기는 키웠어요',
    rows: [
      ['보는 곳', <>외판 PIN JIG 도면<small>‘FRAME ANGLE’ 칸의 숫자와 FWD 표시</small></>],
      ['넣는 것', <>숫자 + FRAME 이 누운 쪽 (선수 / 선미)<small>누운 쪽 = LONGL. 라인의 낮은 끝</small></>],
      ['현물', '선수를 보고 서서 FRAME 웹에 폰 뒷면을 붙여요 (위아래 두 번)'],
    ],
    warn: <>F.A 선미 블록이면 TS 캡 · DECK LONGL. 라인은 <b>선수 쪽이 높아요</b>. 누운 쪽을 반대로 넣으면 판정이 보류돼요.</>,
    rel: ['TA', 'B'],
  },
];

const byKey = (k: TermKey) => TERMS.find((t) => t.key === k)!;

function TermSheet(p: { term: TermKey | null; onPick: (k: TermKey) => void; onClose: () => void }) {
  const t = p.term ? byKey(p.term) : null;
  const Fig = t?.fig;
  const box = useRef<HTMLDivElement>(null);
  // '같이 보면 좋아요' 로 다른 용어를 열면 시트 맨 위부터 보이게
  useLayoutEffect(() => {
    box.current?.closest('.sheet')?.scrollTo(0, 0);
  }, [p.term]);
  return (
    <Sheet open={!!t} onClose={p.onClose}>
      {t && Fig && (
        <div key={t.key} ref={box}>
          <div class="gd-eyebrow">{t.eyebrow}</div>
          <h2>{t.name}</h2>
          <p class="sub gd-sub">{t.sub}</p>
          <div class="gd-fig">
            <Fig />
          </div>
          <div class="gd-fig-note">
            <span>{t.figNote}</span>
            {(t.key === 'A' || t.key === 'B') && (
              <a href={IMG} target="_blank" rel="noopener">
                전체 그림
              </a>
            )}
          </div>
          <div class="mt16">
            {t.rows.map(([k, v]) => (
              <div class="gd-kv">
                <span class="k">{k}</span>
                <span class="v">{v}</span>
              </div>
            ))}
          </div>
          <div class="gd-warn">
            <IWarnFill />
            <span>{t.warn}</span>
          </div>
          <div class="gd-rel">
            <span>같이 보면 좋아요</span>
            {t.rel.map((k) => (
              <button class="gd-chip" onClick={() => p.onPick(k)}>
                {byKey(k).name.split(' · ')[0]}
              </button>
            ))}
          </div>
          <button class="btn" onClick={p.onClose}>
            확인
          </button>
        </div>
      )}
    </Sheet>
  );
}

/* ── 화면 */

export function GuideScreen() {
  const [term, setTerm] = useState<TermKey | null>(null);
  return (
    <div class="screen with-tab no-cta">
      <BrandBar />
      <Headline title={<>무엇이<br />궁금하세요?</>} />

      <div class="gd-card">
        <div class="gd-card-h">지주캡 하나에서 두 번 재요 (TS 캡)</div>
        <div class="gd-tiles">
          <button class="gd-tile" onClick={() => setTerm('A')}>
            <CapCrop kind="a" label="TS 캡 각도 A 측정 방향" />
            <b class="c-a">A · WEB 방향</b>
            <span>폭 방향 · 숫자만</span>
          </button>
          <button class="gd-tile" onClick={() => setTerm('B')}>
            <CapCrop kind="b" label="TS 캡 각도 B 측정 방향" />
            <b class="c-b">B · WEB 직각</b>
            <span>선수미 방향 · 높은 쪽</span>
          </button>
        </div>
      </div>

      <div class="section-title">
        <span>용어</span>
        <span>{TERMS.length}</span>
      </div>
      <div class="list">
        {TERMS.map((t) => (
          <button class="row compact" onClick={() => setTerm(t.key)}>
            <div class={'lead ' + t.leadCls}>{t.lead}</div>
            <div class="body">
              <div class="t1">{t.name}</div>
              <div class="t2">{t.line}</div>
            </div>
            <div class="tail">
              <span class="chev">
                <IChevron />
              </span>
            </div>
          </button>
        ))}
      </div>

      <div class="divider" />
      <div class="gd-links">
        <button class="gd-link" onClick={() => go('/guide/steps')}>
          <span>재는 법</span>
          <b>지주캡 재는 순서</b>
        </button>
        <button class="gd-link warn" onClick={() => go('/guide/caution')}>
          <span>주의할 점</span>
          <b>꼭 지킬 것 {RULES.reduce((n, g) => n + g.items.length, 0)}가지</b>
        </button>
      </div>

      <TermSheet term={term} onPick={setTerm} onClose={() => setTerm(null)} />
    </div>
  );
}

const STEPS: { t: string; d: ComponentChildren; b?: boolean; judge?: boolean }[] = [
  { t: '블록 넣기', d: 'T.A · F.A + FRAME 이 누운 쪽(외판 PIN JIG 도면), 잴 때 캡이 보는 쪽(바닥 / 하늘). 모르면 비우고 현물에서 재요' },
  { t: '캡 넣기', d: 'δ + 돌아간 방향, 외판 기울기 θ (LIFTING LUG 도면). 정상 A · B 가 계산돼요' },
  { t: '각도 B 재기', d: '브라켓에 폰을 세워 기대고, 폰 머리 → 선수 확인', b: true },
  { t: '각도 A 재기', d: 'WEB 에 폰을 세워 기대요. 숫자만, 방향은 상관없어요' },
  { t: '판정 보기', d: 'A · B 편차가 합격 허용오차(기본 ±3°) 안인지 봐요', judge: true },
  { t: '기록 저장', d: '메모 · 사진을 붙여 저장 → 기록 탭에서 보고서 · CSV' },
];

export function GuideStepsScreen() {
  return (
    <div class="screen">
      <TopBar backTo="/guide" />
      <Headline eyebrow="재는 법" title={<>지주캡은 이 순서로<br />재요</>} />
      <div class="gd-steps">
        {STEPS.map((s, i) => (
          <div class="gd-step">
            <div class="rail">
              <span class={'n' + (s.b ? ' b' : '')}>{i + 1}</span>
              {i < STEPS.length - 1 && <span class="bar" />}
            </div>
            <div class="txt">
              <b>{s.t}</b>
              <p>{s.d}</p>
              {s.judge && (
                <div class="gd-judge">
                  <div>
                    <span class="badge good">OK</span>A · B 둘 다 허용오차 안
                  </div>
                  <div>
                    <span class="badge warn">주의</span>A · B 는 안인데 역산 회전이 큼
                  </div>
                  <div>
                    <span class="badge bad">NG</span>A 나 B 가 허용오차를 넘음
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <Cta>
        <button class="btn" onClick={() => go('/', true)}>
          측정하러 가기
        </button>
      </Cta>
    </div>
  );
}

const RULES: { h: string; items: [string, string][] }[] = [
  {
    h: '잴 때',
    items: [
      ['FRAME 선이 아니라 캡 WEB · 브라켓 기준', 'FRAME · LONGL. 선을 따라 재면 δ 만큼 틀어져요'],
      ['B 는 폰 머리 → 선수, 잴 때마다 확인', '높은 쪽이 바뀌면 판정이 뒤집혀요'],
      ['폰은 세워서 긴 옆면을 대요', '긴 축을 위아래로 세워 WEB 에 대면 안 돼요'],
      ['판정은 디지털 수평계가 먼저', '폰은 기기 · 케이스에 따라 0.1 ~ 0.5° 틀려요'],
    ],
  },
  {
    h: '넣을 때',
    items: [
      ['부호(−) 대신 숫자 + 선수 / 선미', '도면에 적힌 그대로 넣으면 부호는 앱이 붙여요'],
      ['턴오버한 블록은 ‘캡이 하늘을 봄’', '깜빡하면 캡 방향 계산이 반대가 돼요'],
      ['θ 를 모르면 비워 두고 재요', '나중에 넣으면 그 캡 기록을 다시 계산해요'],
    ],
  },
  {
    h: '폰 준비',
    items: [['영점 · 뒷면 보정은 처음 한 번', '케이스를 바꾸면 다시 해요 (설정 탭)']],
  },
];

export function GuideCautionScreen() {
  let n = 0;
  return (
    <div class="screen no-cta">
      <TopBar backTo="/guide" />
      <Headline eyebrow="주의할 점" title={<>이것만 지키면<br />실수가 없어요</>} />
      {RULES.map((g) => (
        <div style={{ marginBottom: '12px' }}>
          <div class="section-title">
            <span>{g.h}</span>
          </div>
          {g.items.map(([t, d]) => (
            <div class="gd-rule">
              <span class="n">{++n}</span>
              <div>
                <b>{t}</b>
                <span>{d}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
