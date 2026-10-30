'use client';

import { useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Icon } from './icons';
import type { IconName } from './icons';
import { useEscape } from './ui';
import { normalizeSearch } from './domain';

export type PaletteEntry = { id: string; label: string; hint: string; icon: IconName; run: () => void };

export function CommandPalette({ entries, onClose }: { entries: PaletteEntry[]; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  useEscape(onClose);

  const results = useMemo(() => {
    const needle = normalizeSearch(query);
    const matches = needle ? entries.filter((entry) => normalizeSearch(`${entry.label} ${entry.hint}`).includes(needle)) : entries;
    return matches.slice(0, 9);
  }, [entries, query]);

  function pick(entry?: PaletteEntry) { if (entry) { onClose(); entry.run(); } }
  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setCursor((value) => Math.min(value + 1, results.length - 1)); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setCursor((value) => Math.max(value - 1, 0)); }
    if (event.key === 'Enter') { event.preventDefault(); pick(results[cursor]); }
  }

  return (
    <div className="overlay overlay-top" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div aria-label="Hızlı arama" aria-modal="true" className="palette" role="dialog">
        <label className="palette-input">
          <Icon name="search" />
          <input aria-label="Ara" autoFocus onChange={(event) => { setQuery(event.target.value); setCursor(0); }} onKeyDown={onKeyDown} placeholder="Sayfa, içerik veya ekran ara…" value={query} />
          <kbd>Esc</kbd>
        </label>
        <div className="palette-list" role="listbox">
          {results.length ? results.map((entry, index) => (
            <button aria-selected={index === cursor} className={index === cursor ? 'palette-item active' : 'palette-item'} key={entry.id} onClick={() => pick(entry)} onMouseEnter={() => setCursor(index)} role="option" type="button">
              <Icon name={entry.icon} size={17} /><strong>{entry.label}</strong><small>{entry.hint}</small>
            </button>
          )) : <p className="palette-empty">Sonuç bulunamadı.</p>}
        </div>
      </div>
    </div>
  );
}
