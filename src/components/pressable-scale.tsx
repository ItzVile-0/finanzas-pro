import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useMotion } from '@/hooks/use-motion';

type Props = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> };

const SPRING = { damping: 20, stiffness: 400 };

// El estilo y la escala van en el MISMO Pressable: si el estilo quedara en una vista interior, el área tocable
// no coincidiría con lo que se ve (p. ej. position: 'absolute' del botón + o el ancho de una columna).
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable que se encoge a 0,97 al presionar. Deshabilitado, con Animaciones suaves o desactivadas → sin animación. */
export function PressableScale({ style, disabled, onPressIn, onPressOut, ...rest }: Props) {
  const motion = useMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const animate = !disabled && motion === 'full'; // encogerse es movimiento: solo con Animaciones completas

  return (
    <AnimatedPressable
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      onPressIn={(e) => {
        if (animate) scale.set(withSpring(0.97, SPRING));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (animate) scale.set(withSpring(1, SPRING));
        onPressOut?.(e);
      }}
      {...rest}
      style={[style, animatedStyle]}
    />
  );
}
