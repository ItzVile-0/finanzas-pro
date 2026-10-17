import { useEffect } from 'react';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';

import { motionDuration } from '@/domain/motion';
import { useMotion } from '@/hooks/use-motion';

/**
 * Progreso 0 → 1 para dibujar un gráfico o llenar una barra: al montarse y cada vez que cambian los datos
 * (`signature`, p. ej. los montos unidos). Sin animaciones queda en 1 desde el principio.
 */
export function useDrawProgress(signature: string, duration = 700) {
  const motion = useMotion();
  const progress = useSharedValue(motion === 'off' ? 1 : 0);
  useEffect(() => {
    if (motion === 'off') {
      progress.set(1);
      return;
    }
    progress.set(0);
    progress.set(withTiming(1, { duration: motionDuration(motion, duration), easing: Easing.out(Easing.cubic) }));
  }, [signature, motion, duration, progress]);
  return progress;
}
