// Tienda (opcional, con el nombre que elija el usuario): control sencillo de inversión y venta. TS puro:
// sin SQLite ni React. Cada registro es una fila de `transactions` con scope 'business': así el saldo y la historia sin
// días negativos funcionan igual que para cualquier movimiento.
import type { ColorKey, IconKey } from './category-style';
import { isValidISODate } from './dates';
import { checkHistory, type Account, type NewTransaction, type Transaction } from './ledger';
import { sum } from './money';
import { fold } from './search';
import { lastMonths, type Range } from './periods';

/** Canal de venta (tabla `channels`, migración 6). Los 4 primeros conservan los ids del CHECK de la migración 5. */
export type Channel = { id: string; name: string; sort_order: number; archived: boolean };
export const CHANNEL_NAME_MAX = 30;
/** Nombre de la tienda si el usuario lo deja vacío. */
export const DEFAULT_STORE_NAME = 'Mi tienda';
/** Canales de la migración 6 (se ofrecen en la bienvenida y los recibe una copia anterior al restaurarse). */
export const DEFAULT_CHANNELS: [id: string, name: string][] = [
  ['whatsapp', 'WhatsApp'],
  ['instagram', 'Instagram'],
  ['marketplace', 'Marketplace'],
  ['web', 'Página web'],
];

export const INVESTMENT_CATEGORY_ID = 'cat-b-inversion';
export const SALE_CATEGORY_ID = 'cat-b-venta';
/** Categorías fijas (no se muestran ni se eligen en ninguna lista), con el nombre que dejó la migración 6. */
export const STORE_CATEGORIES: [id: string, kind: 'income' | 'expense', name: string, icon: IconKey, color: ColorKey][] = [
  [INVESTMENT_CATEGORY_ID, 'expense', 'Inversión de la tienda', 'shopping', 'pink'],
  [SALE_CATEGORY_ID, 'income', 'Venta de la tienda', 'sell', 'green'],
];

export type RecordType = 'investment' | 'sale';
export const RECORD_LABEL: Record<RecordType, string> = { investment: 'Inversión', sale: 'Venta' };

/** Tipo de registro de la tienda, o null si es un movimiento personal. */
export function recordTypeOf(tx: Pick<Transaction, 'scope' | 'kind'>): RecordType | null {
  if (tx.scope !== 'business') return null;
  return tx.kind === 'income' ? 'sale' : 'investment';
}

export type RecordInput = { type: RecordType; amount: number; date: string; accountId: string; channel: string | null; note: string };
export type RecordErrors = Partial<Record<'type' | 'amount' | 'date' | 'accountId' | 'channel' | 'note', string>>;
export type NewRecord = NewTransaction & { channel_id: string | null };

const NOTE_MAX = 200;

/**
 * Inversión (sale de la cuenta) o venta (entra a la cuenta, con canal). Con `original`, edición: el tipo no cambia.
 * Ninguna cuenta queda en negativo en ningún día (también al editar una venta o cambiarla de cuenta).
 */
export function validateRecord(
  input: RecordInput,
  ctx: { accounts: readonly Account[]; transactions: readonly Transaction[]; channels: readonly Channel[]; today: string },
  original?: Transaction,
): { ok: true; tx: NewRecord } | { ok: false; errors: RecordErrors } {
  if (input.type !== 'investment' && input.type !== 'sale') return { ok: false, errors: { type: 'Elige inversión o venta.' } };
  if (original && recordTypeOf(original) !== input.type) {
    return { ok: false, errors: { type: 'El tipo no se cambia: elimina el registro y crea uno nuevo.' } };
  }
  const errors: RecordErrors = {};
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) errors.amount = 'El valor debe ser un entero mayor que 0.';
  if (!isValidISODate(input.date)) errors.date = 'Fecha inválida. Usa AAAA-MM-DD, por ejemplo 2026-10-31.';
  else if (input.date > ctx.today) errors.date = 'No se permiten fechas futuras.';
  // Al editar se acepta la cuenta archivada que ya tenía; no se puede elegir otra archivada.
  const account = ctx.accounts.find((a) => a.id === input.accountId && (!a.archived || a.id === original?.account_id));
  if (!account) errors.accountId = 'Elige la cuenta.';
  // Igual que la cuenta: al editar se acepta el canal archivado que ya tenía.
  const channel = ctx.channels.find((c) => c.id === input.channel && (!c.archived || c.id === original?.channel_id));
  if (input.type === 'sale' && !channel) errors.channel = 'Elige el canal de la venta.';
  if (input.type === 'investment' && input.channel !== null) errors.channel = 'Una inversión no lleva canal.';
  if (input.note.trim().length > NOTE_MAX) errors.note = `Máximo ${NOTE_MAX} caracteres.`;
  if (Object.keys(errors).length > 0 || !account) return { ok: false, errors };

  const sale = input.type === 'sale';
  const tx: NewRecord = {
    scope: 'business',
    kind: sale ? 'income' : 'expense',
    amount: input.amount,
    date: input.date,
    account_id: account.id,
    to_account_id: null,
    category_id: sale ? SALE_CATEGORY_ID : INVESTMENT_CATEGORY_ID,
    note: input.note.trim(),
    channel_id: sale ? (channel?.id ?? null) : null,
  };
  const others = original ? ctx.transactions.filter((t) => t.id !== original.id) : ctx.transactions;
  const history = checkHistory(ctx.accounts, ctx.transactions, [...others, tx], [account.id, original?.account_id ?? null]);
  if (history) return { ok: false, errors: { amount: history } };
  return { ok: true, tx };
}

export type ChannelLine = { channel: string; amount: number; count: number; share: number };
export type Totals = { invested: number; sold: number; profit: number };

const totals = (txs: readonly Transaction[]): Totals => {
  const invested = sum(txs.filter((t) => recordTypeOf(t) === 'investment').map((t) => t.amount));
  const sold = sum(txs.filter((t) => recordTypeOf(t) === 'sale').map((t) => t.amount));
  return { invested, sold, profit: sold - invested };
};

/**
 * Ganancia del periodo (vendido − invertido dentro del rango) y acumulada (desde el primer registro, sin importar el
 * periodo: invertir un mes y vender el siguiente engaña si solo se mira un mes). Ventas por canal del periodo (id del
 * canal, también los archivados), de mayor a menor, sin canales en 0; share = fracción del total vendido.
 */
export function storeSummary(txs: readonly Transaction[], { from, to }: Range) {
  const records = txs.filter((t) => recordTypeOf(t) !== null);
  const inRange = records.filter((t) => t.date >= from && t.date <= to);
  const period = totals(inRange);
  const byChannel = new Map<string, Transaction[]>();
  for (const t of inRange) {
    if (recordTypeOf(t) !== 'sale') continue;
    const key = t.channel_id ?? '';
    byChannel.set(key, [...(byChannel.get(key) ?? []), t]);
  }
  const channels: ChannelLine[] = [...byChannel].map(([channel, sales]) => {
    const amount = sum(sales.map((t) => t.amount));
    return { channel, amount, count: sales.length, share: period.sold > 0 ? amount / period.sold : 0 };
  }).sort((a, b) => b.amount - a.amount);
  return {
    period,
    cumulative: totals(records),
    channels,
    /** Fracción vendida frente a vendido + invertido (barra); null si ambos son 0. */
    soldShare: period.sold + period.invested > 0 ? period.sold / (period.sold + period.invested) : null,
    hasRecords: records.length > 0,
  };
}

/** Vendido, invertido y ganancia de cada uno de los últimos `months` meses (el actual hasta hoy), y el total de esos meses. */
export function monthlyProfit(txs: readonly Transaction[], today: string, months = 6) {
  const records = txs.filter((t) => recordTypeOf(t) !== null);
  const ranges = lastMonths(today, months);
  const within = (from: string, to: string) => records.filter((t) => t.date >= from && t.date <= to);
  return {
    months: ranges.map(({ from, to, month, label }) => ({ month, label, ...totals(within(from, to)) })),
    total: totals(within(ranges[0].from, today)),
  };
}

/** Nombre de canal: obligatorio, máximo CHANNEL_NAME_MAX y sin repetir otro canal (sin mirar mayúsculas ni tildes). */
export function validateChannelName(raw: string, channels: readonly Channel[], editingId?: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (!name) return { ok: false, error: 'Escribe el nombre del canal.' };
  if (Array.from(name).length > CHANNEL_NAME_MAX) return { ok: false, error: `Máximo ${CHANNEL_NAME_MAX} caracteres.` };
  if (channels.some((c) => c.id !== editingId && fold(c.name) === fold(name))) return { ok: false, error: 'Ya hay un canal con ese nombre.' };
  return { ok: true, name };
}

/** Un canal con ventas no se elimina (se archiva); no se archiva ni elimina el último activo (una venta necesita canal). */
export function channelRemoval(id: string, channels: readonly Channel[], txs: readonly Transaction[]): { canDelete: boolean; canArchive: boolean } {
  const target = channels.find((c) => c.id === id);
  const lastActive = !!target && !target.archived && !channels.some((c) => !c.archived && c.id !== id);
  return { canDelete: !lastActive && !txs.some((t) => t.channel_id === id), canArchive: !lastActive };
}
