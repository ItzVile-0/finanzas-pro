// Movimiento en pantalla (respetar siempre "reducir animaciones" del sistema). TS puro.
import type { Animations } from './settings';

/** El ajuste de la app, salvo que el sistema pida reducir animaciones: entonces nada se mueve. */
export const effectiveMotion = (setting: Animations, systemReduced: boolean): Animations => (systemReduced ? 'off' : setting);

/** Duración de una animación: completa, al 60 % en Suaves, 0 sin animaciones. */
export const motionDuration = (motion: Animations, ms: number): number => (motion === 'off' ? 0 : motion === 'soft' ? Math.round(ms * 0.6) : ms);
