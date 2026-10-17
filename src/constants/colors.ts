import type { Accent } from '@/domain/settings';

/**
 * Sistema visual de Finanzas Pro: negro y dorado (oscuro) + marfil y dorado (claro). El dorado es el acento por defecto;
 * AccentColors cambia solo primary, primaryText, onPrimary, highlight y primaryBorder (business sigue siendo de la tienda).
 * primary = dorado para RELLENOS (botones, interruptores); primaryText = dorado para texto, bordes e íconos sobre el fondo
 * (en claro, el dorado de relleno no llega a 4,5:1); onPrimary = texto sobre relleno dorado o rosa.
 * income/expense = verde/rojo suaves; business = la tienda (rosa vino); highlight = tarjeta de saldo;
 * primaryBorder = borde de la tarjeta de saldo; separator = líneas entre filas; track = fondo de barras; overlay = fondo detrás de diálogos.
 * Contrastes verificados en src/domain/contrast.test.ts (WCAG AA, 4,5:1).
 */

export const Colors = {
  light: {
    text: '#1A1712',
    background: '#FAF8F3',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#F0EBDF',
    textSecondary: '#6E675A',
    border: '#E6DFD0',
    primary: '#C9A24A',
    primaryText: '#86651D',
    onPrimary: '#1A1408',
    income: '#237A4B',
    expense: '#B8433A',
    business: '#A8406F',
    highlight: '#F6EEDC',
    primaryBorder: '#C9A24A55',
    separator: '#EEE8DC',
    track: '#E9E3D6',
    overlay: 'rgba(26,23,18,0.45)',
  },
  dark: {
    text: '#F5F3EE',
    background: '#0D0D0F',
    backgroundElement: '#17171B',
    backgroundSelected: '#232329',
    textSecondary: '#9A968C',
    border: '#2A2A31',
    primary: '#D4AF61',
    primaryText: '#D4AF61',
    onPrimary: '#1A1408',
    income: '#4FBF8B',
    expense: '#E5675C',
    business: '#E07A9E',
    highlight: '#1A1712',
    primaryBorder: '#D4AF6155',
    separator: '#202026',
    track: '#26262D',
    overlay: 'rgba(0,0,0,0.6)',
  },
} as const;

/** Opacidad de los fondos tintados (color + TINT ≈ 15 %): chips elegidos y círculos de ícono. */
export const TINT = '26';

type AccentKey = 'primary' | 'primaryText' | 'onPrimary' | 'highlight' | 'primaryBorder';
type AccentTones = Record<'light' | 'dark', Record<AccentKey, string>>;
const pickAccent = (c: (typeof Colors)['light' | 'dark']) =>
  ({ primary: c.primary, primaryText: c.primaryText, onPrimary: c.onPrimary, highlight: c.highlight, primaryBorder: c.primaryBorder });

/** Tonos de cada acento para claro y oscuro (contraste AA en contrast.test.ts). Borde = relleno al ~33 % (+ '55'). */
export const AccentColors: Record<Accent, AccentTones> = {
  gold: { light: pickAccent(Colors.light), dark: pickAccent(Colors.dark) },
  silver: {
    light: { primary: '#A9AFB8', primaryText: '#5A626E', onPrimary: '#14171B', highlight: '#EEF0F3', primaryBorder: '#A9AFB855' },
    dark: { primary: '#C4C9D0', primaryText: '#C4C9D0', onPrimary: '#121418', highlight: '#16181C', primaryBorder: '#C4C9D055' },
  },
  // Inclinado al turquesa: el verde de ingresos (income) es otro tono y no se confunde.
  emerald: {
    light: { primary: '#1FA396', primaryText: '#0E6E68', onPrimary: '#03161A', highlight: '#E3F4F2', primaryBorder: '#1FA39655' },
    dark: { primary: '#3EC6BC', primaryText: '#3EC6BC', onPrimary: '#03161A', highlight: '#0E1A1A', primaryBorder: '#3EC6BC55' },
  },
  copper: {
    light: { primary: '#C47A4C', primaryText: '#8C4A24', onPrimary: '#1C0E06', highlight: '#F9EEE6', primaryBorder: '#C47A4C55' },
    dark: { primary: '#DB9061', primaryText: '#DB9061', onPrimary: '#1C0E06', highlight: '#1C1410', primaryBorder: '#DB906155' },
  },
  sapphire: {
    light: { primary: '#2F5FC4', primaryText: '#2A55B0', onPrimary: '#FFFFFF', highlight: '#E8EEF9', primaryBorder: '#2F5FC455' },
    dark: { primary: '#7AA3F2', primaryText: '#7AA3F2', onPrimary: '#0A1328', highlight: '#111724', primaryBorder: '#7AA3F255' },
  },
};

/** Paleta completa por acento y modo, armada una sola vez (useTheme devuelve siempre el mismo objeto). */
export const Palettes = Object.fromEntries(
  (Object.keys(AccentColors) as Accent[]).map((a) => [
    a,
    { light: { ...Colors.light, ...AccentColors[a].light }, dark: { ...Colors.dark, ...AccentColors[a].dark } },
  ]),
) as Record<Accent, { light: (typeof Colors)['light']; dark: (typeof Colors)['dark'] }>;

/** Colores de categoría (claves de src/domain/category-style.ts): tono para tema claro y para oscuro. */
export const CategoryColors = {
  slate: { light: '#64748B', dark: '#94A3B8' },
  red: { light: '#DC2626', dark: '#F87171' },
  orange: { light: '#EA580C', dark: '#FB923C' },
  amber: { light: '#D97706', dark: '#FBBF24' },
  green: { light: '#16A34A', dark: '#4ADE80' },
  teal: { light: '#0D9488', dark: '#2DD4BF' },
  blue: { light: '#2563EB', dark: '#60A5FA' },
  indigo: { light: '#4F46E5', dark: '#818CF8' },
  purple: { light: '#9333EA', dark: '#C084FC' },
  pink: { light: '#DB2777', dark: '#F472B6' },
} as const;
