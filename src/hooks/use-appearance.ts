// Apariencia global (acento, tokens de tamaño, animaciones, vibración, primer día de la semana y la tienda: pestaña y nombre): como el tema con Appearance, un cambio vuelve a dibujar toda la app al
// instante. Lo llenan applyAppearance (al iniciar, restaurar o deshacer) y useSettings().save; lo leen useTheme y useTokens.
import { useSyncExternalStore } from 'react';

import { DEFAULT_SETTINGS, type Settings } from '@/domain/settings';

export type AppearanceState = Pick<Settings, 'accent' | 'font' | 'textScale' | 'density' | 'corners' | 'animations' | 'haptics' | 'weekStart' | 'storeEnabled' | 'storeName'>;
export const APPEARANCE_KEYS = ['accent', 'font', 'textScale', 'density', 'corners', 'animations', 'haptics', 'weekStart', 'storeEnabled', 'storeName'] as const satisfies readonly (keyof AppearanceState)[];

let state: AppearanceState = {
  accent: DEFAULT_SETTINGS.accent,
  font: DEFAULT_SETTINGS.font,
  textScale: DEFAULT_SETTINGS.textScale,
  density: DEFAULT_SETTINGS.density,
  corners: DEFAULT_SETTINGS.corners,
  animations: DEFAULT_SETTINGS.animations,
  haptics: DEFAULT_SETTINGS.haptics,
  weekStart: DEFAULT_SETTINGS.weekStart,
  storeEnabled: DEFAULT_SETTINGS.storeEnabled,
  storeName: DEFAULT_SETTINGS.storeName,
};
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const getAppearance = () => state;

/** Aplica solo las claves de apariencia del cambio (las demás se ignoran). */
export function setAppearance(patch: Partial<Settings>) {
  let changed = false;
  const next = { ...state };
  for (const k of APPEARANCE_KEYS) {
    const v = patch[k];
    if (v !== undefined && v !== state[k]) {
      (next as Record<string, unknown>)[k] = v;
      changed = true;
    }
  }
  if (!changed) return;
  state = next;
  listeners.forEach((l) => l());
}

export const useAppearance = () => useSyncExternalStore(subscribe, getAppearance);
