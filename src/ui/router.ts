// 해시 주소 이동 (#/block/abc …) — 정적 호스팅(GitHub Pages)에서도 새로고침이 안전하다
// history.state.depth 로 '앱 안에서 몇 번 들어왔는지'를 기억해, 뒤로 버튼이 앱 밖으로 나가지 않게 한다.
import { useEffect, useState } from 'preact/hooks';

const EVT = 'routechange';

export function currentPath(): string {
  const h = location.hash.replace(/^#/, '');
  return h || '/';
}

function depth(): number {
  return (history.state as { depth?: number } | null)?.depth ?? 0;
}

// ── 열린 바텀시트 — 폰 뒤로가기는 화면을 나가지 않고 맨 위 시트만 닫는다.
// 화면 스크롤 잠금도 '열린 시트 수' 하나로 정한다 (닫히는 순서와 상관없이 0 이면 풀림).
const sheetClosers: (() => void)[] = [];
let programmatic = false; // 앱이 직접 부른 뒤로(back) — 시트가 열려 있어도 그대로 이동
let shown = { path: currentPath(), depth: depth() };

function syncScrollLock() {
  document.body.style.overflow = sheetClosers.length ? 'hidden' : '';
}

/** 시트가 열릴 때 등록, 돌려받은 함수로 해제 */
export function registerSheet(close: () => void): () => void {
  sheetClosers.push(close);
  syncScrollLock();
  return () => {
    const i = sheetClosers.lastIndexOf(close);
    if (i >= 0) sheetClosers.splice(i, 1);
    syncScrollLock();
  };
}

export function useRoute(): string {
  const [p, set] = useState(currentPath());
  useEffect(() => {
    const on = () => {
      const np = currentPath();
      shown = { path: np, depth: depth() };
      set((old) => {
        if (old !== np) window.scrollTo(0, 0);
        return np;
      });
      syncScrollLock(); // 안전장치 : 남은 시트가 없으면 잠금을 푼다
    };
    const onPop = () => {
      if (!programmatic && sheetClosers.length && currentPath() !== shown.path) {
        // 폰 뒤로가기 : 주소를 되돌려 놓고 맨 위 시트만 닫는다
        history.pushState({ depth: shown.depth }, '', '#' + shown.path);
        sheetClosers[sheetClosers.length - 1]();
        return;
      }
      programmatic = false;
      on();
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', on);
    window.addEventListener(EVT, on);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', on);
      window.removeEventListener(EVT, on);
    };
  }, []);
  return p;
}

export function go(path: string, replace = false) {
  if (replace) history.replaceState({ depth: depth() }, '', '#' + path);
  else history.pushState({ depth: depth() + 1 }, '', '#' + path);
  window.dispatchEvent(new Event(EVT));
}

/** 뒤로 — 앱 안 이동 이력이 없으면 상위 경로로 바꿔 끼운다 */
export function back(fallback = '/') {
  if (depth() > 0) {
    programmatic = true;
    history.back();
  } else go(fallback, true);
}

/** '/block/:id' 형태 매칭 */
export function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const out: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) out[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return out;
}
