// Tamaño de letra para nombres en celdas angostas (cuadrícula de categorías), sin partir palabras.
// En Android adjustsFontSizeToFit no es confiable: se calcula con la palabra más larga y el ancho de la celda.

/** Ancho medio de una letra de Inter Medium en proporción al tamaño (conservador, incluye el espaciado). */
const CHAR_WIDTH = 0.62;
export const LABEL_MAX = 13;
export const LABEL_MIN = 10;

/**
 * Tamaño (LABEL_MIN..max) con el que la palabra más larga cabe en `width` px. `charWidth` es el de la fuente elegida
 * (tokens) y `max` crece con el tamaño de letra; el mínimo no, para que quepa en la celda.
 */
export function labelFontSize(label: string, width: number, charWidth = CHAR_WIDTH, max = LABEL_MAX): number {
  const longest = Math.max(1, ...label.split(/\s+/).map((w) => w.length));
  const fit = Math.floor(width / (longest * charWidth));
  return Math.min(Math.max(max, LABEL_MIN), Math.max(LABEL_MIN, fit));
}

/** Tamaño (min..base) con el que `text` cabe en una línea de `width` px: montos grandes que no se cortan. */
export function fitFontSize(text: string, width: number, base: number, min: number, charWidth = CHAR_WIDTH): number {
  const chars = Math.max(1, Array.from(text).length);
  return Math.max(min, Math.min(base, Math.floor(width / (chars * charWidth))));
}
