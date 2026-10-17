import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { motionDuration } from '@/domain/motion';
import { useMotion } from '@/hooks/use-motion';
import { useScreenReader } from '@/hooks/use-screen-reader';

/**
 * Botón flotante que se baja `distance` px al desplazar hacia abajo y vuelve al subir, cerca del inicio o al volver a la
 * pantalla. Con TalkBack nunca se oculta (es la acción principal y se busca por gestos, no a la vista).
 */
export function useHideOnScroll(distance: number) {
  const motion = useMotion();
  const canHide = !useScreenReader();
  const duration = motionDuration(motion, 200);
  const hidden = useSharedValue(0);
  const lastY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler(
    {
      onScroll: (e) => {
        const y = e.contentOffset.y;
        const dy = y - lastY.get();
        lastY.set(y);
        if (!canHide || y <= 24) hidden.set(0);
        else if (dy > 6) hidden.set(1);
        else if (dy < -6) hidden.set(0);
      },
    },
    [canHide],
  );

  useFocusEffect(
    useCallback(() => {
      hidden.set(0);
    }, [hidden]),
  );

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: withTiming(hidden.get() * distance, { duration }) }] }));
  return { onScroll, style };
}
