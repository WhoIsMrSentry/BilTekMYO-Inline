export type Backdrop = 'none' | 'galaxy';
export type Surface = 'admin' | 'display';

export type ThemeDefinition = {
  id: string;
  label: string;
  description: string;
  /** Shown in the theme picker. */
  swatches: [string, string, string];
  /** Browser UI colour for mobile address bars. */
  themeColor: string;
  backdrop: Record<Surface, Backdrop>;
};

/**
 * The single list of themes. To add one, append it here and create
 * themes/<id>.css in each app; the picker and runtime pick it up from this list.
 */
export const themes: ThemeDefinition[] = [
  { id: 'cosmos', label: 'Kozmos', description: 'Sade uzay terminali', swatches: ['#0e0f12', '#3a3e46', '#9fc4e8'], themeColor: '#0e0f12', backdrop: { admin: 'none', display: 'galaxy' } },
  { id: 'nebula', label: 'Nebula', description: 'Mor yıldız bulutu', swatches: ['#13111c', '#8e5cf0', '#ff7ac6'], themeColor: '#13111c', backdrop: { admin: 'none', display: 'galaxy' } },
  { id: 'galaxy', label: 'Galaksi', description: 'Bordo ve yeşil uzay', swatches: ['#030204', '#ff2d55', '#38c808'], themeColor: '#08040a', backdrop: { admin: 'galaxy', display: 'galaxy' } },
  { id: 'observatory', label: 'Gözlemevi', description: 'Petrol yeşili ve pirinç', swatches: ['#0b1f21', '#1f8f86', '#e0b860'], themeColor: '#0b1f21', backdrop: { admin: 'none', display: 'galaxy' } },
  { id: 'mars', label: 'Mars', description: 'Pas ve kum tonları', swatches: ['#161110', '#d9622b', '#e8b27a'], themeColor: '#161110', backdrop: { admin: 'none', display: 'galaxy' } },
];

export const defaultTheme = themes[0]!;
export const themeById = (id: string | null | undefined) => themes.find((theme) => theme.id === id);
