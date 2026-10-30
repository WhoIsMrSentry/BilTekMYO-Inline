'use client';

import { useSyncExternalStore } from 'react';
import { storageKey } from './boot';
import { defaultTheme, themeById } from './registry';
import type { ThemeDefinition } from './registry';

export function applyTheme(theme: ThemeDefinition) {
  document.documentElement.dataset.palette = theme.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.themeColor);
  try { window.localStorage.setItem(storageKey, theme.id); } catch { /* The theme still applies for this visit. */ }
}

function subscribe(listener: () => void) {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-palette'] });
  return () => observer.disconnect();
}

/** The attribute on <html> is the source of truth, so every consumer stays in step. */
export function useActiveTheme(): ThemeDefinition {
  return useSyncExternalStore(
    subscribe,
    () => themeById(document.documentElement.dataset.palette) ?? defaultTheme,
    () => defaultTheme,
  );
}
