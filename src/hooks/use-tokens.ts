import { StyleSheet } from 'react-native';

import { tokensFor, type Tokens } from '@/constants/tokens';
import { useAppearance } from '@/hooks/use-appearance';

/** Tokens de la apariencia actual (fuente, tamaño de letra, densidad y esquinas). Mismo objeto mientras no cambie. */
export function useTokens(): Tokens {
  const { font, textScale, density, corners } = useAppearance();
  return tokensFor({ font, textScale, density, corners });
}

/** Estilos que dependen de los tokens: se crean una vez por juego de tokens y se vuelven a crear si cambian. */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (t: Tokens) => T): () => T {
  const cache = new WeakMap<Tokens, T>();
  return function useStyles() {
    const t = useTokens();
    let styles = cache.get(t);
    if (!styles) {
      styles = StyleSheet.create(factory(t));
      cache.set(t, styles);
    }
    return styles;
  };
}
