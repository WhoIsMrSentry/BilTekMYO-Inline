'use client';

import { useEffect } from 'react';
import { themeById, themes } from './registry';
import { applyTheme } from './runtime';

export const rotationMinutes = 30;
const rotationMs = rotationMinutes * 60_000;
const checkMs = 15_000;

/** Derived from the clock, not a timer, so every screen in the school changes together. */
function scheduledTheme(now: number) {
  return themes[Math.floor(now / rotationMs) % themes.length]!;
}

/**
 * Keeps a display on the right theme. Priority: ?theme= in the URL, then the admin's choice,
 * then the rotation. A manual pick on the screen stays until the wanted theme next changes.
 */
export function useDisplayTheme(commanded: string | undefined) {
  useEffect(() => {
    const pinned = themeById(new URLSearchParams(window.location.search).get('theme'));
    let wanted = '';
    const sync = () => {
      const theme = pinned ?? themeById(commanded) ?? scheduledTheme(Date.now());
      if (theme.id === wanted) return;
      wanted = theme.id;
      applyTheme(theme);
    };
    sync();
    const timer = window.setInterval(sync, checkMs);
    return () => window.clearInterval(timer);
  }, [commanded]);
}
