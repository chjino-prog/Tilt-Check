// 시각화 : 편차 게이지, 기울기 겹침 그림, 지주캡 평면도
import { useSettings } from '../../settings';
import { devLevel, fmt, fmtSigned } from '../../calc/judge';

const LEVEL_VAR = { good: '--green', warn: '--orange', bad: '--red', none: '--text-4' } as const;
const v = (name: string) => `var(${name})`;
const HALO = { paintOrder: 'stroke', stroke: 'var(--fig-bg)', strokeWidth: 5, strokeLinejoin: 'round' } as const;

/** 편차 게이지 : 가운데 0, ±5° 범위, 허용 구간 음영 */
export function Gauge(p: { dev: number | null }) {
  const s = useSettings();
  const R = 5;
  const X0 = 14;
  const W = 292;
  const x = (d: number) => X0 + ((Math.max(-R, Math.min(R, d)) + R) / (2 * R)) * W;
  const dev = p.dev;
  const lvl = devLevel(dev, s);
  const over = dev != null && Math.abs(dev) > R;
  const ticks = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];
  return (
    <div class="gauge" aria-label="편차 게이지">
      <svg viewBox="0 0 320 62">
        <rect x={X0} y={20} width={W} height={12} rx={6} style={{ fill: v('--red-weak') }} />
        <rect x={x(-s.tol2)} y={20} width={x(s.tol2) - x(-s.tol2)} height={12} style={{ fill: v('--orange-weak') }} />
        <rect x={x(-s.tol1)} y={20} width={x(s.tol1) - x(-s.tol1)} height={12} style={{ fill: v('--green-weak') }} />
        {ticks.map((t) => (
          <line x1={x(t)} x2={x(t)} y1={t === 0 ? 16 : 34} y2={t === 0 ? 36 : 38} style={{ stroke: v('--text-4'), strokeWidth: t === 0 ? 2 : 1 }} />
        ))}
        {[-5, 0, 5].map((t) => (
          <text x={x(t)} y={54} text-anchor="middle" font-size="12" style={{ fill: v('--text-3') }}>
            {t > 0 ? '+' + t : t === 0 ? '0' : '−' + -t}°
          </text>
        ))}
        {dev != null && isFinite(dev) && (
          <g style={{ transition: 'transform 0.15s ease-out', transform: `translateX(${x(dev)}px)` }}>
            <line x1={0} x2={0} y1={10} y2={42} style={{ stroke: v(LEVEL_VAR[lvl]), strokeWidth: 3.5, strokeLinecap: 'round' }} />
            <path d={over ? (dev! > 0 ? 'M-5 2 L5 7 L-5 12 Z' : 'M5 2 L-5 7 L5 12 Z') : 'M-7 2 L7 2 L0 10 Z'} style={{ fill: v(LEVEL_VAR[lvl]) }} />
          </g>
        )}
      </svg>
    </div>
  );
}

const D2R = Math.PI / 180;

/** 기울기 그림 : 정상 라인(점선) · 실측 라인(실선) 겹침 + 틀어진 각 호 */
export function LineFigure(p: { normal: number; meas: number | null }) {
  const s = useSettings();
  const cx = 28;
  const cy = 168;
  const n = Math.abs(p.normal);
  const m = p.meas == null ? null : Math.abs(p.meas);
  const dev = m == null ? null : m - n;
  // 차이가 작으면 눈에 보이도록 5배로 그린다 (그림 아래에 표시)
  const k = dev != null && Math.abs(dev) < 5 ? 5 : 1;
  const shown = dev == null ? null : Math.max(0, Math.min(89, n + dev * k));
  const len = (a: number) => Math.min(270, 150 / Math.max(Math.sin(a * D2R), 0.01));
  const end = (a: number, L: number) => [cx + L * Math.cos(a * D2R), cy - L * Math.sin(a * D2R)];
  const [nx, ny] = end(n, len(n));
  const lvl = devLevel(dev, s);
  const color = v(LEVEL_VAR[lvl === 'none' ? 'good' : lvl]);
  let arc = '';
  let label: [number, number] | null = null;
  if (shown != null) {
    const r = Math.min(len(n), len(shown)) * 0.72;
    const [ax, ay] = end(n, r);
    const [bx, by] = end(shown, r);
    arc = `M${ax} ${ay} A${r} ${r} 0 0 ${shown > n ? 0 : 1} ${bx} ${by}`;
    const mid = (n + shown) / 2;
    label = end(mid, r + 22) as [number, number];
  }
  const [mx, my] = shown == null ? [0, 0] : end(shown, len(shown));
  return (
    <div class="fig">
      <svg viewBox="0 0 320 186">
        <line x1={cx} y1={cy} x2={312} y2={cy} style={{ stroke: v('--line'), strokeWidth: 2 }} />
        <text x={306} y={cy - 6} text-anchor="end" font-size="11" style={{ fill: v('--text-3') }}>
          수평
        </text>
        <line x1={cx} y1={cy} x2={nx} y2={ny} style={{ stroke: v('--text-3'), strokeWidth: 2.5, strokeDasharray: '7 6' }} />
        {shown != null && (
          <>
            <path d={arc} style={{ fill: 'none', stroke: color, strokeWidth: 2.5 }} />
            <line x1={cx} y1={cy} x2={mx} y2={my} style={{ stroke: v('--blue'), strokeWidth: 3.5, strokeLinecap: 'round' }} />
            {label && (
              <text x={label[0]} y={label[1]} text-anchor="middle" dominant-baseline="middle" font-size="15" font-weight="700" style={{ fill: color, ...HALO }}>
                {fmtSigned(dev, s.decimals)}°
              </text>
            )}
          </>
        )}
        <circle cx={cx} cy={cy} r={4} style={{ fill: v('--text') }} />
      </svg>
      <div class="legend">
        <span>
          <i class="dash" style={{ color: v('--text-3') }} />
          정상 {fmt(n, s.decimals)}°
        </span>
        <span>
          <i style={{ color: v('--blue') }} />
          실측 {m == null ? '—' : fmt(m, s.decimals) + '°'}
        </span>
        {k > 1 && dev != null && <span>차이는 {k}배로 그림</span>}
      </div>
    </div>
  );
}

/** 지주캡 평면도 : FRAME선(빨강 점선), 도면 WEB(회색), 실제 WEB(파랑), δ_real 호 */
export function PlanFigure(p: { delta: number; dir: 1 | -1; deltaReal: number | null }) {
  const s = useSettings();
  const cx = 160;
  const cy = 112;
  const L = 130;
  const pt = (a: number, r: number) => [cx + r * Math.cos(a * D2R), cy - r * Math.sin(a * D2R)];
  const seg = (a: number) => {
    const [x1, y1] = pt(a, L);
    const [x2, y2] = pt(a + 180, L);
    return { x1, y1, x2, y2 };
  };
  const design = p.dir * p.delta;
  const real = p.deltaReal == null ? null : p.dir * p.deltaReal;
  let arc = '';
  let lab: number[] | null = null;
  if (real != null && Math.abs(real) > 0.05) {
    const r = 86;
    const [ax, ay] = pt(0, r);
    const [bx, by] = pt(real, r);
    arc = `M${ax} ${ay} A${r} ${r} 0 0 ${real > 0 ? 0 : 1} ${bx} ${by}`;
    lab = pt(real / 2, r + 26);
  }
  return (
    <div class="fig">
      <svg viewBox="0 0 320 224">
        <text x={cx} y={16} text-anchor="middle" font-size="12" font-weight="600" style={{ fill: v('--text-3') }}>
          ▲ 선수
        </text>
        <text x={cx} y={218} text-anchor="middle" font-size="12" font-weight="600" style={{ fill: v('--text-3') }}>
          선미 ▼
        </text>
        <line x1={14} y1={cy} x2={306} y2={cy} style={{ stroke: v('--frame-red'), strokeWidth: 2, strokeDasharray: '8 6' }} />
        <line {...seg(design)} style={{ stroke: v('--text-4'), strokeWidth: 3, strokeLinecap: 'round' }} />
        {real != null && (
          <>
            {arc && <path d={arc} style={{ fill: 'none', stroke: v('--blue'), strokeWidth: 2 }} />}
            <line {...seg(real)} style={{ stroke: v('--blue'), strokeWidth: 3.5, strokeLinecap: 'round' }} />
            {lab && (
              <text x={lab[0]} y={lab[1]} text-anchor="middle" dominant-baseline="middle" font-size="13" font-weight="700" style={{ fill: v('--blue'), ...HALO }}>
                {fmt(p.deltaReal, s.decimals)}°
              </text>
            )}
          </>
        )}
        <circle cx={cx} cy={cy} r={4} style={{ fill: v('--text') }} />
      </svg>
      <div class="legend">
        <span>
          <i class="dash" style={{ color: v('--frame-red') }} />
          FRAME선
        </span>
        <span>
          <i style={{ color: v('--text-4') }} />
          도면 WEB {fmt(p.delta, s.decimals)}°
        </span>
        <span>
          <i style={{ color: v('--blue') }} />
          실제 WEB {p.deltaReal == null ? '—' : fmt(p.deltaReal, s.decimals) + '°'}
        </span>
      </div>
    </div>
  );
}
