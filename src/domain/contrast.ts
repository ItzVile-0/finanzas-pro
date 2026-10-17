// Contraste WCAG 2.x entre dos colores '#RRGGBB'. AA: 4,5:1 texto normal; 3:1 texto grande e íconos.

function luminance(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`Color inválido (se espera #RRGGBB): ${hex}`);
  const [r, g, b] = m.slice(1).map((h) => {
    const v = parseInt(h, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razón de contraste (1 a 21), sin importar el orden de los colores. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Color `fg` con opacidad `alphaHex` ('00'–'FF') sobre el fondo opaco `bg`, como lo pinta la pantalla. */
export function blend(fg: string, alphaHex: string, bg: string): string {
  const rgb = (hex: string) => {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m) throw new Error(`Color inválido (se espera #RRGGBB): ${hex}`);
    return m.slice(1).map((h) => parseInt(h, 16));
  };
  const a = parseInt(alphaHex, 16) / 255;
  const [f, b] = [rgb(fg), rgb(bg)];
  return '#' + f.map((v, i) => Math.round(v * a + b[i] * (1 - a)).toString(16).padStart(2, '0')).join('').toUpperCase();
}
