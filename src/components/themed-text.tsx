import { Text, type TextProps } from 'react-native';

import { ThemeColor } from '@/constants/theme';
import type { TextType } from '@/constants/tokens';
import { useTheme } from '@/hooks/use-theme';
import { useTokens } from '@/hooks/use-tokens';

export type ThemedTextProps = TextProps & {
  type?: TextType;
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const t = useTokens();

  // La letra del sistema se respeta hasta el tope total de la app (tokens): con Muy grande nada se desborda.
  return <Text maxFontSizeMultiplier={t.maxFontSizeMultiplier} style={[{ color: theme[themeColor ?? 'text'] }, t.type[type], style]} {...rest} />;
}
