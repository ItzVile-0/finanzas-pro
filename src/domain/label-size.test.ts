import { fitFontSize, LABEL_MAX, LABEL_MIN, labelFontSize } from './label-size';

// Celda de 3 columnas en un teléfono de 360 dp: ~100 px de texto.
const CELL = 100;

describe('labelFontSize', () => {
  it('nombres reales de las categorías base', () => {
    expect(labelFontSize('Entretenimiento', CELL)).toBe(10); // 15 letras
    expect(labelFontSize('Trabajos independientes', CELL)).toBe(11); // "independientes" = 14
    expect(labelFontSize('Suscripciones', CELL)).toBe(12); // 13
    expect(labelFontSize('Ahorro y aportes a inversiones', CELL)).toBe(13); // "inversiones" = 11
    expect(labelFontSize('Salud', CELL)).toBe(LABEL_MAX);
  });

  it('la palabra más larga cabe con el tamaño elegido (salvo el mínimo)', () => {
    for (const name of ['Entretenimiento', 'Trabajos independientes', 'Suscripciones']) {
      const size = labelFontSize(name, CELL);
      const longest = Math.max(...name.split(' ').map((w) => w.length));
      expect(longest * size * 0.62).toBeLessThanOrEqual(CELL);
    }
  });

  it('nunca baja del mínimo legible ni pasa del máximo; espacios extra no cuentan', () => {
    expect(labelFontSize('Supercalifragilístico', 40)).toBe(LABEL_MIN);
    expect(labelFontSize('a', 500)).toBe(LABEL_MAX);
    expect(labelFontSize('  Salud   y  más ', CELL)).toBe(LABEL_MAX);
  });
});

describe('labelFontSize con la fuente y el tamaño de letra elegidos', () => {
  it('una fuente más ancha achica; el máximo sube con la letra, el mínimo no', () => {
    expect(labelFontSize('Suscripciones', CELL, 0.68)).toBeLessThan(labelFontSize('Suscripciones', CELL, 0.62));
    expect(labelFontSize('Salud', CELL, 0.62, 17)).toBe(17);
    expect(labelFontSize('Entretenimiento', CELL, 0.68, 17)).toBe(LABEL_MIN);
  });
});

describe('fitFontSize (montos grandes en una línea)', () => {
  it('cabe en el ancho, sin pasar del tamaño base ni bajar del mínimo', () => {
    const amount = '$ 1.234.567.890'; // 15 caracteres
    expect(fitFontSize('$ 50.000', 320, 34, 14, 0.62)).toBe(34);
    const size = fitFontSize(amount, 320, 52, 14, 0.68);
    expect(size).toBeLessThan(52);
    expect(15 * size * 0.68).toBeLessThanOrEqual(320);
    expect(fitFontSize(amount, 80, 52, 14, 0.68)).toBe(14);
    expect(fitFontSize('', 320, 40, 14)).toBe(40);
  });
});
