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

export function useRoute(): string {
  const [p, set] = useState(currentPath());
  useEffect(() => {
    const on = () => {
      const np = currentPath();
      set((old) => {
        if (old !== np) window.scrollTo(0, 0);
        return np;
      });
    };
    window.addEventListener('popstate', on);
    window.addEventListener('hashchange', on);
    window.addEventListener(EVT, on);
    return () => {
      window.removeEventListener('popstate', on);
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
  if (depth() > 0) history.back();
  else go(fallback, true);
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
