'use client';

import { useEffect, useState } from 'react';
import { Galaxy } from './galaxy';
import type { Surface } from './registry';
import { useActiveTheme } from './runtime';

/**
 * Mounts the animated layer the active theme asks for on this surface, and nothing otherwise.
 * Hydration renders with the default theme, so nothing starts until the real one is known:
 * the layer reads its colours from the theme.
 */
export function ThemeBackdrop({ surface, interactive = false }: { surface: Surface; interactive?: boolean }) {
  const theme = useActiveTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || theme.backdrop[surface] !== 'galaxy') return null;
  return <Galaxy interactive={interactive} key={theme.id} />;
}
