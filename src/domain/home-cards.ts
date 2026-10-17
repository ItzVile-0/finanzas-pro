// Tarjetas del Inicio que el usuario ordena y muestra u oculta. El saldo y el aviso de copia de seguridad no están aquí:
// siempre se ven (el aviso evita perder datos). TS puro.

export const HOME_CARDS = ['store', 'budgets', 'upcoming', 'income', 'accounts', 'recent'] as const;
export type HomeCardId = (typeof HOME_CARDS)[number];
export type HomeCard = { id: HomeCardId; visible: boolean };

export const DEFAULT_HOME_CARDS: HomeCard[] = HOME_CARDS.map((id) => ({ id, visible: true }));

const isCardId = (v: unknown): v is HomeCardId => (HOME_CARDS as readonly unknown[]).includes(v);

/**
 * JSON [{id, visible}] guardado en settings. Se descartan ids desconocidos y repetidos; las tarjetas que falten (p. ej.
 * una nueva en una versión futura) se agregan al final, visibles. JSON roto → orden por defecto.
 */
export function parseHomeCards(value: string | undefined): HomeCard[] {
  let raw: unknown;
  try {
    raw = value ? JSON.parse(value) : null;
  } catch {
    raw = null;
  }
  if (!Array.isArray(raw)) return DEFAULT_HOME_CARDS;
  const cards: HomeCard[] = [];
  for (const entry of raw) {
    const id = (entry as { id?: unknown } | null)?.id;
    if (!isCardId(id) || cards.some((c) => c.id === id)) continue;
    cards.push({ id, visible: (entry as { visible?: unknown }).visible !== false });
  }
  for (const id of HOME_CARDS) if (!cards.some((c) => c.id === id)) cards.push({ id, visible: true });
  return cards;
}

/** Sube (-1) o baja (+1) una tarjeta; en el borde no cambia nada. */
export function moveCard(cards: readonly HomeCard[], id: HomeCardId, dir: -1 | 1): HomeCard[] {
  const i = cards.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= cards.length) return [...cards];
  const next = [...cards];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export const toggleCard = (cards: readonly HomeCard[], id: HomeCardId): HomeCard[] =>
  cards.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c));
