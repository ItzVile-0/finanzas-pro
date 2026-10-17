// Búsqueda y filtros de Movimientos. Texto sin distinguir mayúsculas ni tildes ("nomina" encuentra "Nómina"). TS puro.
import type { Account, Category, MovementKind, Transaction } from './ledger';
import type { Range } from './periods';

/** Minúsculas y sin tildes ni diéresis (NFD sin marcas combinables). */
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Tipo para filtrar: el del movimiento personal, o inversión/venta si es de la tienda. */
export type FilterType = MovementKind | 'investment' | 'sale';
export const FILTER_TYPE_LABEL: Record<FilterType, string> = {
  income: 'Ingreso',
  expense: 'Gasto',
  transfer: 'Transferencia',
  investment: 'Inversión',
  sale: 'Venta',
};

export const typeOf = (t: Pick<Transaction, 'scope' | 'kind'>): FilterType =>
  t.scope === 'business' ? (t.kind === 'income' ? 'sale' : 'investment') : t.kind;

/** null = sin ese filtro. range: fechas contables incluidas. */
export type MovementFilters = { text: string; type: FilterType | null; categoryId: string | null; accountId: string | null; range: Range | null };

/**
 * Movimientos que cumplen TODOS los filtros, en el mismo orden. El texto (cada palabra, en cualquier orden) se busca en la
 * nota, la categoría, la cuenta de origen o destino y el canal; la cuenta filtra por origen o destino (transferencias).
 */
export function filterMovements(
  txs: readonly Transaction[],
  f: MovementFilters,
  names: { accounts: readonly Pick<Account, 'id' | 'name'>[]; categories: readonly Pick<Category, 'id' | 'name'>[]; channels: readonly { id: string; name: string }[] },
): Transaction[] {
  const words = fold(f.text).split(/\s+/).filter(Boolean);
  const account = new Map(names.accounts.map((a) => [a.id, a.name]));
  const category = new Map(names.categories.map((c) => [c.id, c.name]));
  const channel = new Map(names.channels.map((c) => [c.id, c.name]));
  return txs.filter((t) => {
    if (f.type && typeOf(t) !== f.type) return false;
    if (f.categoryId && t.category_id !== f.categoryId) return false;
    if (f.accountId && t.account_id !== f.accountId && t.to_account_id !== f.accountId) return false;
    if (f.range && (t.date < f.range.from || t.date > f.range.to)) return false;
    if (words.length === 0) return true;
    const haystack = fold(
      [
        t.note,
        t.category_id ? category.get(t.category_id) : '',
        account.get(t.account_id),
        t.to_account_id ? account.get(t.to_account_id) : '',
        t.channel_id ? channel.get(t.channel_id) : '',
      ].join(' '),
    );
    return words.every((w) => haystack.includes(w));
  });
}
