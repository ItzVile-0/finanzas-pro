import { CORNERS, DENSITIES, FONTS, TEXT_SCALES } from '@/domain/settings';

import { buildTokens, DEFAULT_TOKENS, FONT_META, MAX_TOTAL_FONT_SCALE, tokensFor, type AppearanceOptions } from './tokens';

const ALL: AppearanceOptions[] = FONTS.flatMap((font) =>
  TEXT_SCALES.flatMap((textScale) => DENSITIES.flatMap((density) => CORNERS.map((corners) => ({ font, textScale, density, corners })))),
);

describe('tokens', () => {
  it('por defecto (Inter, Normal, Normal, Redondeadas) son exactamente las medidas de antes de la 4g', () => {
    expect(DEFAULT_TOKENS.type).toEqual({
      display: { fontFamily: 'Inter_700Bold', fontSize: 34, lineHeight: 42, letterSpacing: -0.5 },
      title: { fontFamily: 'Inter_700Bold', fontSize: 28, lineHeight: 34, letterSpacing: -0.3 },
      subtitle: { fontFamily: 'Inter_600SemiBold', fontSize: 20, lineHeight: 26 },
      default: { fontFamily: 'Inter_500Medium', fontSize: 16, lineHeight: 22 },
      small: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
      smallBold: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 },
      caption: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
      link: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 30 },
    });
    expect(DEFAULT_TOKENS.amount).toEqual({ fontFamily: 'Inter_600SemiBold', fontSize: 40, lineHeight: 52 });
    expect(DEFAULT_TOKENS.input).toEqual({ fontFamily: 'Inter_500Medium', fontSize: 16 });
    expect(DEFAULT_TOKENS.space).toEqual({ half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 });
    expect(DEFAULT_TOKENS.radius).toEqual({ card: 20, tile: 16, control: 14, field: 12, segment: 11, bar: 4, pill: 999, handle: 2 });
    expect(DEFAULT_TOKENS.icon).toEqual({ xs: 12, sm: 14, md: 16, chevron: 18, lg: 20, nav: 22, xl: 24, fab: 28 });
    expect(DEFAULT_TOKENS.avatar).toEqual({ xs: 28, sm: 32, md: 36, base: 40, lg: 44, hero: 72 });
    expect(DEFAULT_TOKENS.size).toMatchObject({ touch: 44, fab: 56, calendarDay: 38, accountCard: 140, actionMinHeight: 140 });
  });

  it(`las ${ALL.length} combinaciones de apariencia son usables`, () => {
    expect(ALL).toHaveLength(7 * 4 * 3 * 3);
    for (const o of ALL) {
      const t = buildTokens(o);
      const label = JSON.stringify(o);
      for (const style of [...Object.values(t.type), t.amount]) {
        const size = style.fontSize!;
        // ningún texto por debajo de 11 y el alto de línea nunca menor que el alto natural de la fuente (Android corta)
        expect([label, size >= 11]).toEqual([label, true]);
        expect([label, style.lineHeight! >= size * FONT_META[o.font].lineRatio]).toEqual([label, true]);
      }
      // espacios positivos y en orden; el área táctil no se encoge con Compacta
      const s = Object.values(t.space);
      expect(s.every((v, i) => v >= 1 && (i === 0 || v > s[i - 1]))).toBe(true);
      expect(t.size.touch).toBe(44);
      expect(t.size.calendarDay).toBeGreaterThanOrEqual(38);
      expect(Math.min(...Object.values(t.icon))).toBeGreaterThanOrEqual(10);
      // tope de la letra: escala de la app × la del sistema permitida ≤ MAX_TOTAL_FONT_SCALE
      expect(t.textScale * t.maxFontSizeMultiplier).toBeLessThanOrEqual(MAX_TOTAL_FONT_SCALE + 0.01);
    }
  });

  it('tokensFor devuelve el mismo objeto para la misma combinación (los estilos se cachean por identidad)', () => {
    const o: AppearanceOptions = { font: 'lora', textScale: 'large', density: 'comfortable', corners: 'soft' };
    expect(tokensFor(o)).toBe(tokensFor({ ...o }));
    expect(tokensFor(o)).not.toBe(tokensFor({ ...o, corners: 'straight' }));
  });
});
