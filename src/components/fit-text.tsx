import { useState } from 'react';
import { useWindowDimensions, View, type TextStyle } from 'react-native';

import { ThemedText, type ThemedTextProps } from '@/components/themed-text';
import { fitFontSize } from '@/domain/label-size';
import { useTokens } from '@/hooks/use-tokens';

/** Tamaño final de un texto con estilo `base`: con la letra del sistema (hasta el tope de la app) y encogido para caber en `width`. */
export function useFitSize(text: string, width: number, base: TextStyle) {
  const t = useTokens();
  const { fontScale } = useWindowDimensions();
  const target = (base.fontSize ?? 16) * Math.min(fontScale, t.maxFontSizeMultiplier);
  const fontSize = width > 0 ? fitFontSize(text, width, target, t.type.small.fontSize ?? 14, t.charWidth) : target;
  return { fontSize, lineHeight: Math.ceil(((base.lineHeight ?? 22) / (base.fontSize ?? 16)) * fontSize) };
}

/**
 * Una línea que se achica hasta caber (saldo y ganancia grandes con cualquier fuente y tamaño de letra). Ya incluye la
 * letra del sistema en el cálculo, por eso no vuelve a escalarla. En Android adjustsFontSizeToFit no es confiable.
 */
export function FitText({ type = 'display', style, children, ...rest }: ThemedTextProps & { children: string }) {
  const [width, setWidth] = useState(0);
  const size = useFitSize(children, width, useTokens().type[type]);
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <ThemedText type={type} numberOfLines={1} allowFontScaling={false} style={[style, size]} {...rest}>
        {children}
      </ThemedText>
    </View>
  );
}
