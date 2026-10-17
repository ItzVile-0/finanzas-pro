import { useReducedMotion } from 'react-native-reanimated';

import { effectiveMotion } from '@/domain/motion';
import { useAppearance } from '@/hooks/use-appearance';

/** 'full' | 'soft' | 'off': el ajuste Animaciones, salvo que el sistema pida reducir animaciones (entonces 'off'). */
export function useMotion() {
  return effectiveMotion(useAppearance().animations, useReducedMotion());
}
