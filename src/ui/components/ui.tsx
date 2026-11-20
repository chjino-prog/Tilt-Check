// 공통 화면 조각 : 상단 막대, 하단 주 버튼, 바텀시트, 토스트, 세그먼트, 토글, 입력칸
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { back } from '../router';
import { IBack, IMore } from '../icons';

export function TopBar(p: { title?: string; backTo?: string; onMore?: () => void; right?: ComponentChildren }) {
  return (
    <header class="topbar">
      <button class="icon-btn" aria-label="뒤로" onClick={() => back(p.backTo ?? '/')}>
        <IBack />
      </button>
      <div class="title">{p.title ?? ''}</div>
      {p.right ??
        (p.onMore ? (
          <button class="icon-btn" aria-label="더보기" onClick={p.onMore}>
            <IMore />
          </button>
        ) : (
          <span class="icon-btn ghost" />
        ))}
    </header>
  );
}

export function BrandBar(p: { right?: ComponentChildren }) {
  return (
    <header class="topbar">
      <div class="brand">TILT CHECK</div>
      {p.right}
    </header>
  );
}

export function Headline(p: { eyebrow?: string; title: ComponentChildren; sub?: ComponentChildren }) {
  return (
    <div class="headline">
      {p.eyebrow && <div class="eyebrow">{p.eyebrow}</div>}
      <h1>{p.title}</h1>
      {p.sub && <p>{p.sub}</p>}
    </div>
  );
}

/** 화면 맨 아래 고정 버튼 (주 버튼 하나 + 보조 하나까지) */
export function Cta(p: { children: ComponentChildren }) {
  return (
    <div class="cta">
      <div class="cta-inner">{p.children}</div>
    </div>
  );
}

export function Sheet(p: { open: boolean; onClose: () => void; children: ComponentChildren }) {
  useEffect(() => {
    if (!p.open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && p.onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [p.open]);
  if (!p.open) return null;
  return (
    <>
      <div class="sheet-dim" onClick={p.onClose} />
      <div class="sheet" role="dialog" aria-modal="true">
        <div class="sheet-handle" />
        {p.children}
      </div>
    </>
  );
}

export function MenuRow(p: { icon?: () => JSX.Element; label: string; danger?: boolean; onClick: () => void }) {
  const I = p.icon;
  return (
    <button class={'menu-row' + (p.danger ? ' danger' : '')} onClick={p.onClick}>
      {I && <I />}
      {p.label}
    </button>
  );
}

/** 확인 시트 (삭제 등) */
export function ConfirmSheet(p: {
  open: boolean;
  title: string;
  sub?: string;
  okLabel: string;
  danger?: boolean;
  onOk: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={p.open} onClose={p.onClose}>
      <h2>{p.title}</h2>
      {p.sub && <p class="sub">{p.sub}</p>}
      <div class="actions">
        <button class="btn grey" onClick={p.onClose}>
          닫기
        </button>
        <button class={'btn' + (p.danger ? ' danger' : '')} onClick={p.onOk}>
          {p.okLabel}
        </button>
      </div>
    </Sheet>
  );
}

// ── 토스트 (어디서나 toast('저장했어요'))
let pushToast: ((m: string) => void) | null = null;
export function toast(msg: string) {
  pushToast?.(msg);
}
export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: number | undefined;
    pushToast = (m) => {
      setMsg(m);
      clearTimeout(t);
      t = window.setTimeout(() => setMsg(null), 2000);
    };
    return () => {
      pushToast = null;
    };
  }, []);
  return msg ? (
    <div class="toast" role="status" key={msg + Date.now()}>
      {msg}
    </div>
  ) : null;
}

export function Seg<T extends string | number>(p: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div class="seg" role="tablist">
      {p.options.map((o) => (
        <button role="tab" aria-selected={o.v === p.value} class={o.v === p.value ? 'on' : ''} onClick={() => p.onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle(p: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={p.on} aria-label={p.label} class={'toggle' + (p.on ? ' on' : '')} onClick={() => p.onChange(!p.on)} />;
}

export function Field(p: { label: string; hint?: string; children: ComponentChildren }) {
  return (
    <div class="field">
      <label>{p.label}</label>
      {p.children}
      {p.hint && <div class="hint">{p.hint}</div>}
    </div>
  );
}

/** 숫자 입력 (소수 · 음수 허용) */
export function NumInput(p: {
  value: string;
  onInput: (v: string) => void;
  placeholder?: string;
  unit?: string;
  autoFocus?: boolean;
}) {
  return (
    <div class="input-wrap">
      <input
        class="input num"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={p.value}
        placeholder={p.placeholder}
        autoFocus={p.autoFocus}
        onInput={(e) => p.onInput((e.target as HTMLInputElement).value)}
      />
      {p.unit && <span class="unit">{p.unit}</span>}
    </div>
  );
}

export function TextInput(p: { value: string; onInput: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <input
      class="input"
      type="text"
      autoComplete="off"
      value={p.value}
      placeholder={p.placeholder}
      autoFocus={p.autoFocus}
      onInput={(e) => p.onInput((e.target as HTMLInputElement).value)}
    />
  );
}

export function Empty(p: { icon: () => JSX.Element; title: string; sub?: string }) {
  const I = p.icon;
  return (
    <div class="empty">
      <div class="art">
        <I />
      </div>
      <h3>{p.title}</h3>
      {p.sub && <p>{p.sub}</p>}
    </div>
  );
}
