// La paleta vive en colors.ts (sin CSS) para que los tests de contraste la importen.
import { Colors } from './colors';

export { AccentColors, CategoryColors, Colors, Palettes, TINT } from './colors';

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// Tipografía, espaciado y medidas: src/constants/tokens.ts (se leen con useTokens/makeStyles).
