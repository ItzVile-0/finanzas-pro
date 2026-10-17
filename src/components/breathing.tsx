import { useEffect, type ReactNode } from 'react';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useMotion } from '@/hooks/use-motion';

/** "Respira" muy suave (escala 1 ↔ 1,05) para dar vida a un estado vacío. Solo con Animaciones completas; corre en el hilo de UI. */
export function Breathing({ children }: { children: ReactNode }) {
  const motion = useMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (motion !== 'full') {
      scale.set(1);
      return;
    }
    scale.set(withRepeat(withTiming(1.05, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(scale);
  }, [motion, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
