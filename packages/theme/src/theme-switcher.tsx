'use client';

import { useEffect, useRef, useState } from 'react';
import { themes } from './registry';
import { applyTheme, useActiveTheme } from './runtime';

export function ThemeSwitcher({ triggerClassName = '', placement = 'below' }: { triggerClassName?: string; placement?: 'below' | 'above' }) {
  const active = useActiveTheme();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="theme-switcher" ref={root}>
      <button aria-expanded={open} aria-haspopup="listbox" aria-label={`Tema seç, şu an ${active.label}`} className={`theme-switcher-trigger ${triggerClassName}`} onClick={() => setOpen((value) => !value)} title="Tema seç" type="button">
        <span className="theme-swatches">{active.swatches.map((color) => <i key={color} style={{ background: color }} />)}</span>
      </button>
      {open && (
        <ul aria-label="Temalar" className={`theme-switcher-menu ${placement}`} role="listbox">
          {themes.map((theme) => (
            <li key={theme.id}>
              <button aria-selected={theme.id === active.id} onClick={() => { applyTheme(theme); setOpen(false); }} role="option" type="button">
                <span className="theme-swatches">{theme.swatches.map((color) => <i key={color} style={{ background: color }} />)}</span>
                <span className="theme-switcher-text"><strong>{theme.label}</strong><small>{theme.description}</small></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
