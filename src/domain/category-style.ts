// Ícono y color de una categoría: claves de un catálogo cerrado (no nombres de ícono ni códigos de color sueltos).
// Los nombres reales de ícono (iOS/Android) y los tonos claro/oscuro viven en la UI; aquí solo las claves y su validación.

export const ICON_KEYS = [
  'tag', 'work', 'laptop', 'percent', 'sell', 'payments', 'home', 'bolt', 'cart', 'bus', 'health', 'school',
  'movie', 'shopping', 'gift', 'subscriptions', 'credit', 'savings', 'more', 'restaurant', 'pets', 'sport', 'travel', 'phone',
] as const;
export const COLOR_KEYS = ['slate', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink'] as const;

export type IconKey = (typeof ICON_KEYS)[number];
export type ColorKey = (typeof COLOR_KEYS)[number];

export const DEFAULT_ICON: IconKey = 'tag';
export const DEFAULT_COLOR: ColorKey = 'slate';

export const isIconKey = (v: unknown): v is IconKey => (ICON_KEYS as readonly unknown[]).includes(v);
export const isColorKey = (v: unknown): v is ColorKey => (COLOR_KEYS as readonly unknown[]).includes(v);

/** Valor leído de la base → clave válida; uno desconocido usa el de por defecto (sin fallar). */
export function parseCategoryStyle(icon: unknown, color: unknown): { icon: IconKey; color: ColorKey } {
  return { icon: isIconKey(icon) ? icon : DEFAULT_ICON, color: isColorKey(color) ? color : DEFAULT_COLOR };
}
