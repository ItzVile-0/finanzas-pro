import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useDrawProgress } from '@/hooks/use-draw';

/** Barra que se llena (x, desde la izquierda) o crece (y, desde abajo) cuando cambian sus datos (`signature`). */
export function Grow({ signature, axis = 'x', style, children }: { signature: string; axis?: 'x' | 'y'; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const progress = useDrawProgress(signature);
  const grow = useAnimatedStyle(() => ({ transform: [axis === 'x' ? { scaleX: progress.get() } : { scaleY: progress.get() }] }));
  return <Animated.View style={[{ transformOrigin: axis === 'x' ? 'left' : 'bottom' }, style, grow]}>{children}</Animated.View>;
}
