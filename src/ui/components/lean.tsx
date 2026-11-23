// FRAME 누운 쪽 그림 — 옆에서 본 FRAME (선미 왼쪽, 선수 오른쪽)
import type { Dir } from '../../calc/angle';
import { dirName } from '../../calc/sign';

/** 누운 쪽 그림. lean 이 없으면 수직 */
export function LeanFigure(p: { lean: Dir | null }) {
  const dx = p.lean ? 17 * p.lean : 0;
  const top = 48 + dx;
  return (
    <svg viewBox="0 0 96 96" role="img" aria-label={p.lean ? `옆에서 본 FRAME : ${dirName(p.lean)}로 누움` : '옆에서 본 FRAME : 수직'}>
      <path d="M8 78 L88 78" class="base" />
      <path d="M48 78 L48 14" class="base" />
      <path d={`M48 78 L${top} 16`} class="line" />
      {p.lean && <path d={`M${48 + 9 * p.lean} 12 L${48 + 22 * p.lean} 12 M${48 + 17 * p.lean} 7 L${48 + 22 * p.lean} 12 L${48 + 17 * p.lean} 17`} class="arrow" />}
      <text x="4" y="93" class={'t' + (p.lean === -1 ? ' on' : '')}>
        선미
      </text>
      <text x="92" y="93" text-anchor="end" class={'t' + (p.lean === 1 ? ' on' : '')}>
        선수
      </text>
    </svg>
  );
}

/** 보는 쪽 그림 — 사람이 바라보는 쪽 화살표 + 웹에 붙인 폰 */
export function FacingFigure(p: { facing: Dir }) {
  const bow = p.facing === 1;
  return (
    <svg class="hull-fig" style={{ height: '96px' }} viewBox="0 0 86 96" role="img" aria-label={`${dirName(p.facing)}를 바라보고 서서 FRAME 웹에 폰 뒷면을 붙임`}>
      <g transform={bow ? undefined : 'translate(86 0) scale(-1 1)'}>
        <rect x="58" y="10" width="7" height="70" rx="1.5" class="hull" />
        <rect x="47" y="28" width="9" height="34" rx="2.5" class="phone" />
        <path d="M10 45 L38 45 M31 38 L38 45 L31 52" class="arrow" />
      </g>
      <text x="4" y="92" class={'hull-t' + (!bow ? ' on' : '')}>
        선미
      </text>
      <text x="82" y="92" text-anchor="end" class={'hull-t' + (bow ? ' on' : '')}>
        선수
      </text>
    </svg>
  );
}
