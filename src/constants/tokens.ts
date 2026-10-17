// Tokens de tamaño (tipografía, espaciado, radios, íconos y medidas). Las pantallas los leen con useTokens()/makeStyles
// (src/hooks/use-tokens.ts), nunca escritos a mano: no-hardcoded.test.ts lo vigila. Sin CSS ni React para que los tests lo importen.
// Con los valores por defecto (Inter, Normal, Normal, Redondeadas) dan exactamente las medidas de antes de la Etapa 4g.
import type { TextStyle } from 'react-native';

import type { Corners, Density, FontKey, TextScale } from '@/domain/settings';

export type FontMeta = {
  label: string;
  /** Prefijo de las familias de @expo-google-fonts (Inter → Inter_400Regular). */
  prefix: string;
  /** Alto natural de la fuente (ascendente + descendente) / tamaño: el alto de línea nunca baja de esto (Android corta). */
  lineRatio: number;
  /** Ancho medio de un carácter / tamaño, conservador: para encoger montos largos sin cortarlos. */
  charWidth: number;
};

/** Métricas de cada fuente (hhea de los .ttf de @expo-google-fonts 0.4). */
export const FONT_META: Record<FontKey, FontMeta> = {
  inter: { label: 'Inter', prefix: 'Inter', lineRatio: 1.21, charWidth: 0.62 },
  manrope: { label: 'Manrope', prefix: 'Manrope', lineRatio: 1.37, charWidth: 0.64 },
  poppins: { label: 'Poppins', prefix: 'Poppins', lineRatio: 1.4, charWidth: 0.68 },
  'dm-sans': { label: 'DM Sans', prefix: 'DMSans', lineRatio: 1.31, charWidth: 0.62 },
  nunito: { label: 'Nunito', prefix: 'Nunito', lineRatio: 1.37, charWidth: 0.6 },
  'space-grotesk': { label: 'Space Grotesk', prefix: 'SpaceGrotesk', lineRatio: 1.28, charWidth: 0.64 },
  lora: { label: 'Lora', prefix: 'Lora', lineRatio: 1.28, charWidth: 0.6 },
};

/** Familias (un nombre por peso). En Android el peso lo da la familia, no fontWeight. */
export const fontFamilies = (font: FontKey) => {
  const p = FONT_META[font].prefix;
  return { regular: `${p}_400Regular`, medium: `${p}_500Medium`, semibold: `${p}_600SemiBold`, bold: `${p}_700Bold` } as const;
};

export const TEXT_SCALE: Record<TextScale, number> = { small: 0.9, normal: 1, large: 1.15, xlarge: 1.3 };
/** Factor de espacios y de íconos por densidad. */
const DENSITY: Record<Density, { space: number; icon: number }> = {
  compact: { space: 0.75, icon: 0.9 },
  normal: { space: 1, icon: 1 },
  comfortable: { space: 1.25, icon: 1.1 },
};
const RADIUS: Record<Corners, { card: number; tile: number; control: number; field: number; segment: number; bar: number; pill: number }> = {
  rounded: { card: 20, tile: 16, control: 14, field: 12, segment: 11, bar: 4, pill: 999 },
  soft: { card: 12, tile: 10, control: 10, field: 8, segment: 7, bar: 3, pill: 12 },
  straight: { card: 4, tile: 4, control: 4, field: 4, segment: 3, bar: 1, pill: 4 },
};
/** Escala total (la de la app × la del sistema) como máximo: con Muy grande y la letra del sistema al máximo nada se desborda. */
export const MAX_TOTAL_FONT_SCALE = 2;
/** Área táctil mínima (Android 48 dp recomienda; 44 es el mínimo de WCAG 2.5.8 AA y el de la app desde la Fase 4). */
const TOUCH = 44;

export type TextType = 'display' | 'title' | 'subtitle' | 'default' | 'small' | 'smallBold' | 'caption' | 'link';
export type AppearanceOptions = { font: FontKey; textScale: TextScale; density: Density; corners: Corners };
export const DEFAULT_APPEARANCE: AppearanceOptions = { font: 'inter', textScale: 'normal', density: 'normal', corners: 'rounded' };

export function buildTokens({ font: fontKey, textScale, density, corners }: AppearanceOptions = DEFAULT_APPEARANCE) {
  const font = fontFamilies(fontKey);
  const { lineRatio, charWidth } = FONT_META[fontKey];
  const k = TEXT_SCALE[textScale];
  const d = DENSITY[density];
  /** Tamaño y alto de línea escalados; el alto nunca menor que el natural de la fuente. */
  const text = (family: string, size: number, line: number, letterSpacing?: number): TextStyle => {
    const fontSize = Math.round(size * k);
    const lineHeight = Math.max(Math.round(line * k), Math.ceil(fontSize * lineRatio));
    return letterSpacing === undefined ? { fontFamily: family, fontSize, lineHeight } : { fontFamily: family, fontSize, lineHeight, letterSpacing };
  };
  const sp = (v: number) => Math.max(1, Math.round(v * d.space));
  const ic = (v: number) => Math.round(v * d.icon);
  return {
    font,
    charWidth,
    lineRatio,
    textScale: k,
    /** Para Text/TextInput: la letra del sistema se respeta, pero la escala total no pasa de MAX_TOTAL_FONT_SCALE. */
    maxFontSizeMultiplier: Math.round((MAX_TOTAL_FONT_SCALE / k) * 100) / 100,
    /** Escala tipográfica de ThemedText (prop `type`). */
    type: {
      display: text(font.bold, 34, 42, -0.5),
      title: text(font.bold, 28, 34, -0.3),
      subtitle: text(font.semibold, 20, 26),
      default: text(font.medium, 16, 22),
      small: text(font.regular, 14, 20),
      smallBold: text(font.semibold, 14, 20),
      caption: text(font.medium, 12, 16, 0.2),
      link: text(font.medium, 14, 30),
    } satisfies Record<TextType, TextStyle>,
    /** Texto de los campos y el monto grande del formulario (AmountField). */
    input: { fontFamily: font.medium, fontSize: Math.round(16 * k) } satisfies TextStyle,
    amount: text(font.semibold, 40, 52),
    space: { half: sp(2), one: sp(4), two: sp(8), three: sp(16), four: sp(24), five: sp(32), six: sp(64) },
    radius: { ...RADIUS[corners], handle: 2 },
    border: { thin: 1, button: 1.5, selected: 2 },
    /** Íconos sueltos (SymbolView). */
    icon: { xs: ic(12), sm: ic(14), md: ic(16), chevron: ic(18), lg: ic(20), nav: ic(22), xl: ic(24), fab: ic(28) },
    /** Íconos sobre círculo (IconCircle, CategoryIcon). */
    avatar: { xs: ic(28), sm: ic(32), md: ic(36), base: ic(40), lg: ic(44), hero: ic(72) },
    size: {
      touch: TOUCH,
      hitSlop: 12,
      fab: 56,
      maxContent: 800,
      dialog: 420,
      calendar: 400,
      /** Círculo del día: crece con la letra (lo limita el ancho de la columna). */
      calendarDay: Math.max(TOUCH - 6, Math.round(38 * k)),
      bar: 8,
      dot: 10,
      swatch: 32,
      handleWidth: 40,
      handleHeight: 4,
      donut: 150,
      donutThickness: 22,
      chartHeight: 120,
      donutLabel: 96,
      /** Tarjetas con texto dentro: crecen con la letra. */
      actionMinHeight: Math.round(140 * k),
      accountCard: Math.round(140 * k),
      amountMinWidth: 60,
    },
  };
}

export type Tokens = ReturnType<typeof buildTokens>;

export const DEFAULT_TOKENS: Tokens = buildTokens();

const cache = new Map<string, Tokens>();
/** Un solo objeto por combinación: makeStyles cachea por identidad y nada se recalcula si no cambió. */
export function tokensFor(o: AppearanceOptions): Tokens {
  const key = `${o.font}|${o.textScale}|${o.density}|${o.corners}`;
  let t = cache.get(key);
  if (!t) {
    t = buildTokens(o);
    cache.set(key, t);
  }
  return t;
}
