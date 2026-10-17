// Reglas de cuentas y movimientos. TS puro: sin SQLite ni React.
import type { ColorKey, IconKey } from './category-style';
import { formatShortDate, isValidISODate } from './dates';
import { formatCOP } from './money';

/** Movimiento: 'personal'. Registro de la tienda (inversión o venta): 'business'. Las cuentas son todas 'personal'. */
export type Scope = 'personal' | 'business';
export type AccountType = 'cash' | 'bank' | 'savings' | 'wallet' | 'other';
/** capital_contribution y owner_withdrawal ya no existen: la migración 5 los convirtió en transferencias. */
export type MovementKind = 'income' | 'expense' | 'transfer';

export type Account = {
  id: string;
  scope: Scope;
  name: string;
  type: AccountType;
  opening_balance: number;
  allow_negative: boolean;
  archived: boolean;
};

export type Category = {
  id: string;
  scope: Scope;
  kind: 'income' | 'expense';
  name: string;
  archived: boolean;
  icon: IconKey;
  color: ColorKey;
};

export type Transaction = {
  id: string;
  scope: Scope;
  kind: MovementKind;
  amount: number;
  date: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  note: string;
  created_at: string;
  /** Pago recurrente que confirmó este gasto y la cuota que pagó (migración 4). */
  recurring_id?: string | null;
  recurring_due?: string | null;
  /** Canal de una venta de la tienda (tabla channels, migración 6); null en todo lo demás. */
  channel_id?: string | null;
  /** Columna de la migración 5 (4 canales fijos): ya no se escribe; solo se conserva al deshacer una eliminación. */
  channel?: string | null;
};

export const PAYROLL_CATEGORY_ID = 'cat-p-nomina';
export const ACCOUNT_TYPES: AccountType[] = ['cash', 'bank', 'savings', 'wallet', 'other'];
export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  bank: 'Banco',
  cash: 'Efectivo',
  savings: 'Ahorros',
  wallet: 'Billetera digital',
  other: 'Otra',
};
const NAME_MAX = 60;
const NOTE_MAX = 200;

// ---------- Cuentas ----------

export type AccountInput = {
  name: string;
  type: AccountType;
  openingBalance: number;
  allowNegative: boolean;
};
export type AccountErrors = Partial<Record<keyof AccountInput, string>>;

export function validateAccount(input: AccountInput): AccountErrors {
  const errors: AccountErrors = {};
  const name = input.name.trim();
  if (!name) errors.name = 'Escribe un nombre.';
  else if (name.length > NAME_MAX) errors.name = `Máximo ${NAME_MAX} caracteres.`;
  if (!ACCOUNT_TYPES.includes(input.type)) errors.type = 'Elige un tipo de cuenta.';
  if (!Number.isSafeInteger(input.openingBalance) || input.openingBalance < 0) {
    errors.openingBalance = 'El saldo inicial debe ser un entero de 0 o más.';
  }
  return errors;
}

/** Editar cuenta: el saldo inicial y quitar allow_negative no pueden dejar ningún día en negativo. */
export function validateAccountEdit(input: AccountInput, account: Account, txs: readonly Transaction[]): AccountErrors {
  const errors = validateAccount(input);
  if (Object.keys(errors).length > 0 || input.allowNegative) return errors;
  const after = { ...account, opening_balance: input.openingBalance };
  if (account.allow_negative) {
    // Al quitar el permiso no hay "peor punto" que respetar: ningún día puede quedar bajo 0.
    const bad = dailyCloses(after, txs).find((d) => d.balance < 0);
    if (bad) {
      errors.allowNegative = `Tiene días en negativo (el ${formatShortDate(bad.date)} quedaría en ${formatCOP(bad.balance)}). Déjalo marcado o corrige esos movimientos.`;
    }
    return errors;
  }
  const history = checkHistory([account], txs, txs, [account.id], after);
  if (history) errors.openingBalance = history;
  return errors;
}

export const ARCHIVE_NEEDS_ZERO = 'Para archivarla, deja el saldo en $ 0 (transfiere lo que quede).';

/** Solo se archiva con saldo 0: una cuenta archivada no suma al saldo total. */
export function canArchiveAccount(balance: number): string | null {
  return balance === 0 ? null : ARCHIVE_NEEDS_ZERO;
}

/** Solo se elimina una cuenta sin movimientos (ni de origen ni de destino); si no, se archiva. */
export function canDeleteAccount(id: string, txs: readonly Transaction[]): string | null {
  return txs.some((t) => t.account_id === id || t.to_account_id === id) ? 'Esta cuenta tiene movimientos: solo se puede archivar.' : null;
}

// ---------- Categorías ----------

/** Categorías base: IDs fijos creados por la migración ('cat-p-…'). Las del usuario tienen UUID. */
export const isBaseCategory = (id: string) => id.startsWith('cat-');
const KIND_PLURAL = { income: 'ingresos', expense: 'gastos' } as const;

/** Nombre de una categoría nueva (sin id) o renombrada. Devuelve el error o null. */
export function validateCategoryName(
  name: string,
  kind: Category['kind'],
  categories: readonly Category[],
  id?: string,
  scope: Scope = 'personal',
): string | null {
  const n = name.trim();
  // Nómina conserva su nombre (sí puede cambiar ícono y color).
  if (id === PAYROLL_CATEGORY_ID && n !== categories.find((c) => c.id === id)?.name) {
    return 'Nómina no se renombra: el resumen de ingresos depende de ella.';
  }
  if (!n) return 'Escribe un nombre.';
  if (n.length > NAME_MAX) return `Máximo ${NAME_MAX} caracteres.`;
  const key = n.toLocaleLowerCase('es');
  const dup = categories.some((c) => c.id !== id && c.scope === scope && c.kind === kind && c.name.trim().toLocaleLowerCase('es') === key);
  return dup ? `Ya existe una categoría de ${KIND_PLURAL[kind]} con ese nombre (revisa también las archivadas).` : null;
}

export function canArchiveCategory(id: string): string | null {
  return id === PAYROLL_CATEGORY_ID ? 'Nómina no se archiva: el resumen de ingresos depende de ella.' : null;
}

/** Solo se eliminan categorías creadas por el usuario y sin movimientos; las base se archivan. */
export function canDeleteCategory(id: string, txs: readonly Transaction[]): string | null {
  if (isBaseCategory(id)) return 'Las categorías base no se eliminan: puedes archivarla.';
  return txs.some((t) => t.category_id === id) ? 'Esta categoría tiene movimientos: solo se puede archivar.' : null;
}

// ---------- Saldos ----------

/** Cuentas que toca un movimiento y cuánto: ingreso +, gasto −, el resto sale del origen y llega al destino. */
function effects(tx: Pick<Transaction, 'kind' | 'amount' | 'account_id' | 'to_account_id'>): [string | null, number][] {
  if (tx.kind === 'income') return [[tx.account_id, tx.amount]];
  if (tx.kind === 'expense') return [[tx.account_id, -tx.amount]];
  return [[tx.account_id, -tx.amount], [tx.to_account_id, tx.amount]];
}

/** Saldo = saldo inicial + ingresos − gastos (también inversiones y ventas de la tienda) ± transferencias. Solo lo guardado. */
export function accountBalances(accounts: readonly Account[], txs: readonly Transaction[]): Map<string, number> {
  const balances = new Map(accounts.map((a) => [a.id, a.opening_balance]));
  for (const tx of txs) {
    if (!Number.isSafeInteger(tx.amount) || tx.amount <= 0) throw new Error(`Importe inválido en ${tx.id}`);
    for (const [id, delta] of effects(tx)) {
      if (id === null || !balances.has(id)) continue;
      const next = balances.get(id)! + delta;
      if (!Number.isSafeInteger(next)) throw new Error(`Saldo fuera de rango en la cuenta ${id}`);
      balances.set(id, next);
    }
  }
  return balances;
}

type HistoryTx = Pick<Transaction, 'kind' | 'amount' | 'date' | 'account_id' | 'to_account_id'>;

/** Saldo al cierre de cada día con movimientos (fecha contable), en orden. */
function dailyCloses(account: Account, txs: readonly HistoryTx[]): { date: string; balance: number }[] {
  const byDate = new Map<string, number>();
  for (const tx of txs) {
    for (const [id, delta] of effects(tx)) if (id === account.id) byDate.set(tx.date, (byDate.get(tx.date) ?? 0) + delta);
  }
  let balance = account.opening_balance;
  return [...byDate.keys()].sort().map((date) => ({ date, balance: (balance += byDate.get(date)!) }));
}

/**
 * Ninguna cuenta (salvo allow_negative) puede quedar en negativo al cierre de NINGÚN día de su historia.
 * Si la cuenta ya tenía un día en negativo (datos viejos), solo se rechaza el cambio que empeora su peor punto.
 * Devuelve el mensaje de error o null. `edited`: la misma cuenta con otro saldo inicial (edición de cuenta).
 */
export function checkHistory(
  accounts: readonly Account[],
  before: readonly HistoryTx[],
  after: readonly HistoryTx[],
  accountIds: readonly (string | null)[],
  edited?: Account,
): string | null {
  for (const account of accounts) {
    if (!accountIds.includes(account.id) || account.allow_negative) continue;
    const floor = Math.min(0, ...dailyCloses(account, before).map((d) => d.balance));
    const bad = dailyCloses(edited?.id === account.id ? edited : account, after).find((d) => d.balance < floor);
    if (bad) {
      return `Saldo insuficiente en ${account.name} el ${formatShortDate(bad.date)}: quedaría en ${formatCOP(bad.balance)}. Revisa la fecha o registra antes el ingreso.`;
    }
  }
  return null;
}

// ---------- Movimientos ----------

export type MovementInput = {
  kind: MovementKind;
  amount: number;
  date: string;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  note: string;
};
export type MovementErrors = Partial<Record<keyof MovementInput, string>>;
export type NewTransaction = Omit<Transaction, 'id' | 'created_at'>;

/** true = lleva cuenta destino (transferencia); false = lleva categoría (ingreso o gasto). */
const HAS_DESTINATION: Record<MovementKind, boolean> = { income: false, expense: false, transfer: true };

export const CHANGE_KIND = 'Para cambiar el tipo, elimina y crea de nuevo.';

export const KIND_LABEL: Record<MovementKind, string> = {
  income: 'Ingreso',
  expense: 'Gasto',
  transfer: 'Transferencia',
};

/** today = todayLocal() del teléfono; se recibe para poder probar. */
type Ctx = { accounts: readonly Account[]; categories: readonly Category[]; transactions: readonly Transaction[]; today: string };

/** Valida un movimiento personal nuevo o, con `original`, la edición de uno guardado (mismo kind). */
export function validateMovement(
  input: MovementInput,
  ctx: Ctx,
  original?: Transaction,
): { ok: true; tx: NewTransaction } | { ok: false; errors: MovementErrors } {
  const errors: MovementErrors = {};
  const withDestination = HAS_DESTINATION[input.kind];
  if (withDestination === undefined) return { ok: false, errors: { kind: 'Elige el tipo de movimiento.' } };
  if (original && !isPersonalMovement(original)) return { ok: false, errors: { kind: 'Este movimiento no se edita aquí.' } };
  if (original && original.kind !== input.kind) return { ok: false, errors: { kind: CHANGE_KIND } };

  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) errors.amount = 'El valor debe ser un entero mayor que 0.';
  if (!isValidISODate(input.date)) errors.date = 'Fecha inválida. Usa AAAA-MM-DD, por ejemplo 2026-10-31.';
  else if (input.date > ctx.today) errors.date = 'No se permiten fechas futuras. Los pagos programados llegarán en su propio módulo.';
  if (input.note.trim().length > NOTE_MAX) errors.note = `Máximo ${NOTE_MAX} caracteres.`;

  // Al editar se acepta la cuenta/categoría archivada que el movimiento ya tenía (no se puede elegir otra archivada).
  const usable = (archived: boolean, id: string, kept: string | null | undefined) => !archived || id === kept;
  const from = ctx.accounts.find((a) => a.id === input.accountId && usable(a.archived, a.id, original?.account_id));
  if (!from) errors.accountId = 'Elige la cuenta.';

  if (!withDestination) {
    if (input.toAccountId !== null) errors.toAccountId = 'Este movimiento no lleva cuenta destino.';
    const cat = ctx.categories.find((c) => c.id === input.categoryId && usable(c.archived, c.id, original?.category_id));
    if (!cat) errors.categoryId = 'Elige una categoría.';
    else if (cat.kind !== input.kind) errors.categoryId = `La categoría no es de ${input.kind === 'income' ? 'ingresos' : 'gastos'}.`;
    else if (cat.scope !== 'personal') errors.categoryId = 'Esa categoría es de la tienda: regístralo en la pestaña de la tienda.';
  } else {
    if (input.categoryId !== null) errors.categoryId = 'Este movimiento no lleva categoría.';
    const to = ctx.accounts.find((a) => a.id === input.toAccountId && usable(a.archived, a.id, original?.to_account_id));
    if (!to) errors.toAccountId = 'Elige la cuenta destino.';
    else if (to.id === input.accountId) errors.toAccountId = 'La cuenta destino debe ser distinta.';
  }

  if (Object.keys(errors).length > 0 || !from) return { ok: false, errors };
  const tx: NewTransaction = {
    scope: 'personal',
    kind: input.kind,
    amount: input.amount,
    date: input.date,
    account_id: from.id,
    to_account_id: withDestination ? input.toAccountId : null,
    category_id: withDestination ? null : input.categoryId,
    note: input.note.trim(),
  };
  const others = original ? ctx.transactions.filter((t) => t.id !== original.id) : ctx.transactions;
  const affected = [tx.account_id, tx.to_account_id, original?.account_id ?? null, original?.to_account_id ?? null];
  const history = checkHistory(ctx.accounts, ctx.transactions, [...others, tx], affected);
  if (history) return { ok: false, errors: { amount: history } };
  return { ok: true, tx };
}

/** null si se puede eliminar (movimiento personal o registro de la tienda); si no, el mensaje (p. ej. el dinero ya se gastó). */
export function validateDelete(id: string, ctx: Pick<Ctx, 'accounts' | 'transactions'>): string | null {
  const original = ctx.transactions.find((t) => t.id === id);
  if (!original) return 'El movimiento ya no existe.';
  const others = ctx.transactions.filter((t) => t.id !== id);
  return checkHistory(ctx.accounts, ctx.transactions, others, [original.account_id, original.to_account_id]);
}

/**
 * Deshacer una eliminación: null si el movimiento puede volver tal cual (mismo id, fecha y cuentas). Se rechaza si ya está,
 * si su cuenta o su categoría ya no existen, o si volver a ponerlo deja un día en negativo (p. ej. un gasto que vuelve
 * después de que ese dinero se usó en otro gasto).
 */
export function validateRestore(
  tx: Transaction,
  ctx: Pick<Ctx, 'accounts' | 'categories' | 'transactions'> & { channels?: readonly { id: string }[] },
): string | null {
  if (ctx.transactions.some((t) => t.id === tx.id)) return 'El movimiento ya está en la lista.';
  const missing = [tx.account_id, tx.to_account_id].some((id) => id !== null && !ctx.accounts.some((a) => a.id === id));
  if (missing) return 'No se puede deshacer: la cuenta ya no existe.';
  if (tx.category_id && !ctx.categories.some((c) => c.id === tx.category_id)) return 'No se puede deshacer: la categoría ya no existe.';
  if (tx.channel_id && ctx.channels && !ctx.channels.some((c) => c.id === tx.channel_id)) return 'No se puede deshacer: el canal ya no existe.';
  return checkHistory(ctx.accounts, ctx.transactions, [...ctx.transactions, tx], [tx.account_id, tx.to_account_id]);
}

/** Movimiento personal (no registro de la tienda). */
export function isPersonalMovement(tx: Pick<Transaction, 'scope'>): boolean {
  return tx.scope === 'personal';
}
