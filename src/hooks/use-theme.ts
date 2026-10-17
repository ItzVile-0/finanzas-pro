/**
 * Paleta actual: modo (claro/oscuro, https://docs.expo.dev/guides/color-schemes/) + color de acento (use-appearance).
 */
import { Palettes } from '@/constants/theme';
import { useAppearance } from '@/hooks/use-appearance';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const scheme = useColorScheme();
  return Palettes[useAppearance().accent][scheme === 'unspecified' ? 'light' : scheme];
}
