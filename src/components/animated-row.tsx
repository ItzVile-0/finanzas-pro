import type { ReactNode } from 'react';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { motionDuration } from '@/domain/motion';
import { useMotion } from '@/hooks/use-motion';

/**
 * Fila que entra (al aparecer un registro nuevo) y sale (al eliminarlo); las demás se acomodan con suavidad.
 * Envolver la lista en <LayoutAnimationConfig skipEntering> para que la primera carga no anime todo.
 * Completas: entra deslizando y las demás se reacomodan; Suaves: solo desvanecer; Desactivadas: nada.
 */
export function AnimatedRow({ children }: { children: ReactNode }) {
  const motion = useMotion();
  if (motion === 'off') return <>{children}</>;
  return (
    <Animated.View
      entering={motion === 'full' ? FadeInDown.duration(260) : FadeIn.duration(motionDuration(motion, 260))}
      exiting={FadeOut.duration(motionDuration(motion, 200))}
      layout={motion === 'full' ? LinearTransition.duration(220) : undefined}>
      {children}
    </Animated.View>
  );
}
