// 캡 자리 외판 기울기 — 어디를 재는지 그림과 도움말
import { Sheet } from './ui';

/** FR 단면 그림 : 외판(곡선) · 캡 · 외판 접선 · 수평선 · 그 사이 각 θ */
export function ShellFigure() {
  return (
    <svg class="shell-fig" viewBox="0 0 220 152" role="img" aria-label="FR 단면에서 캡이 붙은 자리의 외판 접선과 A/B 수평선 사이 각 θ">
      <path class="hull" d="M 64.8 23.8 A 140 140 0 0 0 85.3 140.3" />
      <rect class="cap" x="44" y="96" width="18" height="16" rx="2" />
      <path class="tan" d="M 52.9 57.9 L 79.3 143.9" />
      <path class="hz" d="M 66.1 100.9 L 150 100.9" />
      <path class="ang" d="M 88.1 100.9 A 22 22 0 0 1 72.5 121.9" />
      <text x="74" y="30">외판</text>
      <text x="40" y="108" text-anchor="end">
        캡
      </text>
      <text x="154" y="105">수평(A/B)</text>
      <text x="62" y="141" text-anchor="end">
        접선
      </text>
      <text x="92" y="121" class="on">
        θ
      </text>
    </svg>
  );
}

export function ShellHelpSheet(p: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={p.open} onClose={p.onClose}>
      <h2>외판 기울기는 여기를 재요</h2>
      <p class="sub">캡이 있는 FR 단면도(SECTION)에서 재요. 보는 방향은 상관없어요</p>
      <ShellFigure />
      <div class="where mt16">
        <div class="li ok">
          <span>
            <b>캡이 붙은 점</b>에서 외판 선에 자를 대고, 그 자가 수평선(A/B 기준)과 이루는 각
          </span>
        </div>
        <div class="li ok">
          <span>
            <b>0° ~ 90°</b> 누운 외판은 0°, 벽처럼 선 외판은 90°. 1° 단위면 충분해요
          </span>
        </div>
        <div class="li ok">
          <span>
            <b>왜 필요해요?</b> 도면 δ 는 외판 위에서 잰 각이라, 외판이 서 있을수록 캡 상판은 더 많이 돌아가 있어요 (45° 면 약 1.4배, 60° 면 2배, 73° 면 3.4배)
          </span>
        </div>
      </div>
      <div class="actions mt16">
        <button class="btn" onClick={p.onClose}>
          확인
        </button>
      </div>
    </Sheet>
  );
}
