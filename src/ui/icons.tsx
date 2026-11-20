// 선 아이콘 (24×24, currentColor)
import type { JSX } from 'preact';

const S = (p: { d: string | string[]; w?: number }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={p.w ?? 2} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {(Array.isArray(p.d) ? p.d : [p.d]).map((d) => (
      <path d={d} />
    ))}
  </svg>
);

export const IBack = () => <S d="M15 5l-7 7 7 7" />;
export const IChevron = () => <S d="M9 5l7 7-7 7" />;
export const IMore = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </svg>
);
export const IPlus = () => <S d="M12 5v14M5 12h14" />;
export const ISearch = () => <S d={['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-4-4']} />;
export const ICheck = () => <S d="M5 12.5l4.5 4.5L19 7.5" w={2.6} />;
export const IX = () => <S d="M6 6l12 12M18 6L6 18" w={2.6} />;
export const IMinus = () => <S d="M6 12h12" w={2.6} />;
export const IWarn = () => <S d={['M12 3.5l9.5 16.5h-19z', 'M12 10v4.5', 'M12 17.6v.1']} />;
export const IInfo = () => <S d={['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11v5', 'M12 7.8v.1']} />;
export const IShare = () => <S d={['M12 3v12', 'M7.5 7.5L12 3l4.5 4.5', 'M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6']} />;
export const IEdit = () => <S d={['M4 20h4L19 9l-4-4L4 16z', 'M13.5 6.5l4 4']} />;
export const ICopy = () => <S d={['M9 9h10v10H9z', 'M5 15V5h10']} />;
export const ITrash = () => <S d={['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13']} />;
export const ICamera = () => <S d={['M4 8h3l2-3h6l2 3h3v11H4z', 'M12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z']} />;
export const IImage = () => <S d={['M4 5h16v14H4z', 'M4 16l5-5 4 4 3-3 4 4', 'M15.5 9.5v.1']} />;
export const IRuler = () => <S d={['M3 17L17 3l4 4L7 21z', 'M7 13l2 2', 'M10 10l2 2', 'M13 7l2 2']} />;

/** 탭 : 측정 (기울어진 수평계) */
export const ITabMeasure = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="2.5" y="8.5" width="19" height="7" rx="2" transform="rotate(-12 12 12)" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
  </svg>
);
export const ITabRecord = () => <S d={['M6 3h9l4 4v14H6z', 'M9 11h7', 'M9 15h7', 'M9 7h3']} />;
export const ITabSetting = () => (
  <S
    d={[
      'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
      'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    ]}
    w={1.8}
  />
);

/** 지주캡 (T 모양 단면) */
export const ICap = () => <S d={['M4 7h16', 'M12 7v12', 'M8 19h8']} w={2.2} />;

export type IconC = () => JSX.Element;
