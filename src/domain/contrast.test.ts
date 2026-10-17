import { Colors, Palettes, TINT } from '@/constants/colors';
import { ACCENTS } from '@/domain/settings';

import { blend, contrastRatio } from './contrast';

describe('contrastRatio', () => {
  it('valores de referencia WCAG', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
    expect(contrastRatio('#FFFFFF', '#000000')).toBe(contrastRatio('#000000', '#FFFFFF'));
  });

  it('blend: mezcla con opacidad sobre un fondo opaco', () => {
    expect(blend('#FFFFFF', 'FF', '#000000')).toBe('#FFFFFF');
    expect(blend('#FFFFFF', '00', '#000000')).toBe('#000000');
    expect(blend('#FFFFFF', '80', '#000000')).toBe('#808080');
  });

  it('rechaza colores mal escritos', () => {
    expect(() => contrastRatio('#FFF', '#000000')).toThrow();
  });
});

type Token = keyof typeof Colors.light;
// [texto, fondo] tal como se usan en la app.
const PAIRS: [Token, Token][] = [
  ...(['text', 'textSecondary'] as const).flatMap((t) =>
    (['background', 'backgroundElement', 'highlight'] as const).map((b): [Token, Token] => [t, b]),
  ),
  ['text', 'backgroundSelected'], // pestaña seleccionada
  ['primaryText', 'background'], // "Ver todos", enlaces
  ['primaryText', 'backgroundElement'],
  ...(['income', 'expense'] as const).flatMap((t) =>
    (['background', 'backgroundElement', 'highlight'] as const).map((b): [Token, Token] => [t, b]),
  ),
  ['business', 'background'],
  ['business', 'backgroundElement'],
  ['onPrimary', 'primary'], // texto de botón dorado
  ['background', 'expense'], // texto de botón destructivo
];

// Cada acento en claro y en oscuro (los tonos del acento cambian primary, primaryText, onPrimary y highlight).
describe.each(ACCENTS.flatMap((a) => (['light', 'dark'] as const).map((s) => [a, s] as const)))('acento %s, paleta %s cumple WCAG AA (4,5:1)', (accent, scheme) => {
  it.each(PAIRS)('%s sobre %s', (fg, bg) => {
    expect(contrastRatio(Palettes[accent][scheme][fg], Palettes[accent][scheme][bg])).toBeGreaterThanOrEqual(4.5);
  });
  // Chip elegido: texto sobre el acento al ~15 % (TINT), sobre la pantalla o sobre una tarjeta.
  it.each(['background', 'backgroundElement'] as const)('texto del chip elegido sobre el tinte del acento (sobre %s)', (bg) => {
    const p = Palettes[accent][scheme];
    expect(contrastRatio(p.text, blend(p.primary, TINT, p[bg]))).toBeGreaterThanOrEqual(4.5);
  });
});

it('el dorado es la paleta de siempre', () => {
  expect(Palettes.gold).toEqual(Colors);
});
