// 앱 틀 : 주소 → 화면, 하단 탭(측정 · 기록 · 설정)
import { useEffect } from 'preact/hooks';
import { useSettings } from './settings';
import { go, match, useRoute } from './ui/router';
import { ToastHost } from './ui/components/ui';
import { ITabMeasure, ITabRecord, ITabSetting } from './ui/icons';
import { HomeScreen } from './ui/screens/home';
import { BlockScreen } from './ui/screens/block';
import { CapScreen } from './ui/screens/cap';
import { LineScreen } from './ui/screens/line';
import { RefScreen } from './ui/screens/ref';
import { BlockRecordsScreen, RecordsScreen } from './ui/screens/records';
import { CalibrateScreen, SettingsScreen } from './ui/screens/settings';

function useTheme() {
  const { theme } = useSettings();
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#17171c' : '#ffffff');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

function TabBar(p: { path: string }) {
  const tabs = [
    { to: '/', label: '측정', Icon: ITabMeasure },
    { to: '/records', label: '기록', Icon: ITabRecord },
    { to: '/settings', label: '설정', Icon: ITabSetting },
  ];
  return (
    <nav class="tabbar">
      <div class="tabbar-inner">
        {tabs.map(({ to, label, Icon }) => (
          <button class={'tab' + (p.path === to ? ' on' : '')} aria-current={p.path === to} onClick={() => p.path !== to && go(to, true)}>
            <Icon />
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function App() {
  useTheme();
  const path = useRoute();
  let screen;
  let m: Record<string, string> | null;
  let tab = false;

  if (path === '/') {
    screen = <HomeScreen />;
    tab = true;
  } else if (path === '/records') {
    screen = <RecordsScreen />;
    tab = true;
  } else if (path === '/settings') {
    screen = <SettingsScreen />;
    tab = true;
  } else if (path === '/settings/calibrate') screen = <CalibrateScreen />;
  else if ((m = match('/block/:id', path))) screen = <BlockScreen key={m.id} id={m.id} />;
  else if ((m = match('/block/:id/cap/:cap', path))) screen = <CapScreen key={m.cap} blockId={m.id} capId={m.cap} />;
  else if ((m = match('/block/:id/line', path))) screen = <LineScreen key={m.id} blockId={m.id} />;
  else if ((m = match('/block/:id/ref', path))) screen = <RefScreen key={m.id} blockId={m.id} />;
  else if ((m = match('/records/:id', path))) screen = <BlockRecordsScreen key={m.id} blockId={m.id} />;
  else {
    screen = <HomeScreen />;
    tab = true;
  }

  return (
    <>
      {screen}
      {tab && <TabBar path={path in { '/': 1, '/records': 1, '/settings': 1 } ? path : '/'} />}
      <ToastHost />
    </>
  );
}
