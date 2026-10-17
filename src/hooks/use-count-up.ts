import { useEffect, useState } from 'react';
import { Easing, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { motionDuration } from '@/domain/motion';
import { useMotion } from '@/hooks/use-motion';

/**
 * Cifra que cuenta hasta `target` (pesos enteros): de 0 al montar y del valor anterior al nuevo cuando cambia.
 * Suaves: más corto; Desactivadas o "reducir animaciones": el valor final, sin contar.
 */
export function useCountUp(target: number, duration = 700): number {
  const motion = useMotion();
  const progress = useSharedValue(0);
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (motion === 'off') progress.set(target); // si luego se activan, cuenta desde aquí y no desde 0
    else progress.set(withTiming(target, { duration: motionDuration(motion, duration), easing: Easing.out(Easing.cubic) }));
  }, [motion, target, duration, progress]);

  // Redondeo en el hilo de UI: solo se cruzan enteros, formatCOP rechaza decimales.
  useAnimatedReaction(
    () => Math.round(progress.get()),
    (curr, prev) => {
      if (curr !== prev) scheduleOnRN(setValue, curr);
    },
  );

  return motion === 'off' ? target : value;
}
