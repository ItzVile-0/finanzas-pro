// Repositorio de cuentas, categorías, movimientos, presupuestos y pagos recurrentes. Las reglas viven en src/domain/ledger.ts; aquí solo SQL.
import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { validateBudget, type Budget, type BudgetErrors, type BudgetInput } from '@/domain/budgets';
import { todayLocal } from '@/domain/dates';
import { channelRemoval, validateChannelName, validateRecord, type Channel, type RecordErrors, type RecordInput } from '@/domain/store';
import { isColorKey, isIconKey, parseCategoryStyle, type ColorKey, type IconKey } from '@/domain/category-style';
import {
  accountBalances,
  canArchiveAccount,
  canArchiveCategory,
  canDeleteAccount,
  canDeleteCategory,
  validateAccount,
  validateAccountEdit,
  validateCategoryName,
  validateDelete,
  validateMovement,
  validateRestore,
  type Account,
  type AccountErrors,
  type AccountInput,
  type Category,
  type MovementErrors,
  type MovementInput,
  type NewTransaction,
  type Transaction,
} from '@/domain/ledger';
import {
  dueAfterUndo,
  followingDue,
  toBiweeklyDate,
  usedByActiveRecurring,
  usedByAnyRecurring,
  validateRecurring,
  type Recurring,
  type RecurringErrors,
  type RecurringInput,
} from '@/domain/recurring';

type Flag = { allow_negative?: number; archived: number };
const bool = (n: number | undefined) => n === 1;

export type Ledger = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  recurring: Recurring[];
  /** Canales de venta de la tienda en su orden (también los archivados). */
  channels: Channel[];
};

// shortcut: carga todo el libro en memoria (uso personal, pocos miles de filas); si crece, calcular saldos con SUM en SQL.
export async function loadLedger(db: SQLiteDatabase): Promise<Ledger> {
  const [accounts, categories, transactions, budgets, recurring, channels] = await Promise.all([
    db.getAllAsync<Omit<Account, 'allow_negative' | 'archived'> & Flag>('SELECT * FROM accounts ORDER BY created_at'),
    db.getAllAsync<Omit<Category, 'archived' | 'icon' | 'color'> & Flag & { icon: string; color: string }>(
      'SELECT id, scope, kind, name, archived, icon, color FROM categories ORDER BY rowid',
    ),
    db.getAllAsync<Transaction>('SELECT * FROM transactions ORDER BY date DESC, created_at DESC'),
    db.getAllAsync<Budget>('SELECT id, category_id, amount, alert_pct FROM budgets ORDER BY created_at'),
    db.getAllAsync<Omit<Recurring, 'active'> & { active: number }>('SELECT * FROM recurring_payments ORDER BY next_due_date'),
    db.getAllAsync<Omit<Channel, 'archived'> & Flag>('SELECT id, name, sort_order, archived FROM channels ORDER BY sort_order, rowid'),
  ]);
  return {
    accounts: accounts.map((a) => ({ ...a, allow_negative: bool(a.allow_negative), archived: bool(a.archived) })),
    categories: categories.map((c) => ({ ...c, archived: bool(c.archived), ...parseCategoryStyle(c.icon, c.color) })),
    transactions,
    budgets,
    recurring: recurring.map((r) => ({ ...r, active: bool(r.active) })),
    channels: channels.map((c) => ({ ...c, archived: bool(c.archived) })),
  };
}

export async function createAccount(
  db: SQLiteDatabase,
  input: AccountInput,
  id: string = randomUUID(),
): Promise<{ ok: true; id: string } | { ok: false; errors: AccountErrors }> {
  const errors = validateAccount(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  await db.runAsync(
    "INSERT INTO accounts (id, scope, name, type, opening_balance, allow_negative, created_at) VALUES (?, 'personal', ?, ?, ?, ?, ?)",
    id, input.name.trim(), input.type, input.openingBalance, input.allowNegative ? 1 : 0, new Date().toISOString(),
  );
  return { ok: true, id };
}

/** INSERT de un movimiento ya validado; `link` = plantilla recurrente y cuota que paga; `channel_id` = canal de una venta. */
async function insertTransaction(
  db: SQLiteDatabase,
  id: string,
  t: NewTransaction & { channel_id?: string | null },
  link?: { recurringId: string; due: string },
) {
  await db.runAsync(
    `INSERT INTO transactions (id, scope, kind, amount, date, account_id, to_account_id, category_id, note, created_at, recurring_id, recurring_due, channel_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, t.scope, t.kind, t.amount, t.date, t.account_id, t.to_account_id, t.category_id, t.note, new Date().toISOString(),
    link?.recurringId ?? null, link?.due ?? null, t.channel_id ?? null,
  );
}

/**
 * Valida y guarda en una transacción: el saldo se lee y se escribe sin que otro guardado se cuele en medio.
 * Se usa withTransactionAsync (conexión principal, con foreign_keys = ON); withExclusiveTransactionAsync abre otra conexión sin FK.
 */
export async function saveMovement(
  db: SQLiteDatabase,
  input: MovementInput,
  id: string = randomUUID(),
): Promise<{ ok: true; id: string } | { ok: false; errors: MovementErrors }> {
  let result: { ok: true; id: string } | { ok: false; errors: MovementErrors } = { ok: false, errors: {} };
  await db.withTransactionAsync(async () => {
    const { accounts, categories, transactions } = await loadLedger(db);
    const checked = validateMovement(input, { accounts, categories, transactions, today: todayLocal() });
    if (!checked.ok) {
      result = checked;
      return;
    }
    await insertTransaction(db, id, checked.tx);
    result = { ok: true, id };
  });
  return result;
}

/** Edita un movimiento personal (mismo kind; conserva created_at). Valida la historia de las cuentas viejas y nuevas. */
export async function updateMovement(
  db: SQLiteDatabase,
  id: string,
  input: MovementInput,
): Promise<{ ok: true } | { ok: false; errors: MovementErrors }> {
  let result: { ok: true } | { ok: false; errors: MovementErrors } = { ok: false, errors: {} };
  await db.withTransactionAsync(async () => {
    const { accounts, categories, transactions } = await loadLedger(db);
    const original = transactions.find((t) => t.id === id);
    if (!original) throw new Error('El movimiento ya no existe.');
    const checked = validateMovement(input, { accounts, categories, transactions, today: todayLocal() }, original);
    if (!checked.ok) {
      result = checked;
      return;
    }
    const t = checked.tx;
    await db.runAsync(
      'UPDATE transactions SET scope = ?, amount = ?, date = ?, account_id = ?, to_account_id = ?, category_id = ?, note = ? WHERE id = ? AND kind = ?',
      t.scope, t.amount, t.date, t.account_id, t.to_account_id, t.category_id, t.note, id, original.kind,
    );
    result = { ok: true };
  });
  return result;
}

/** Lo necesario para deshacer una eliminación: la fila tal cual y, si pagaba una cuota, la próxima fecha de antes y después. */
export type DeletedMovement = { tx: Transaction; recurring: { id: string; before: string; after: string } | null };

/** Elimina un movimiento personal o un registro de la tienda si ninguna cuenta queda en negativo en su historia. */
export async function deleteMovement(
  db: SQLiteDatabase,
  id: string,
): Promise<{ ok: true; deleted: DeletedMovement } | { ok: false; error: string }> {
  let result: { ok: true; deleted: DeletedMovement } | { ok: false; error: string } = { ok: false, error: '' };
  await db.withTransactionAsync(async () => {
    const ledger = await loadLedger(db);
    const error = validateDelete(id, ledger);
    if (error) {
      result = { ok: false, error };
      return;
    }
    const tx = ledger.transactions.find((t) => t.id === id);
    const item = tx?.recurring_id ? ledger.recurring.find((r) => r.id === tx.recurring_id) : undefined;
    const back = item && tx?.recurring_due ? dueAfterUndo(item, tx.recurring_due) : null;
    if (item && back) await db.runAsync('UPDATE recurring_payments SET next_due_date = ? WHERE id = ?', back, item.id);
    await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
    result = { ok: true, deleted: { tx: tx!, recurring: item && back ? { id: item.id, before: item.next_due_date, after: back } : null } };
  });
  return result;
}

/**
 * Deshace deleteMovement: la misma fila (id, created_at, cuota y canal) si sigue siendo válida (validateRestore). La cuota
 * del pago recurrente vuelve a la fecha de antes solo si nadie la movió desde la eliminación.
 */
export async function restoreMovement(db: SQLiteDatabase, deleted: DeletedMovement): Promise<{ ok: true } | { ok: false; error: string }> {
  let result: { ok: true } | { ok: false; error: string } = { ok: false, error: '' };
  await db.withTransactionAsync(async () => {
    const ledger = await loadLedger(db);
    const t = deleted.tx;
    const error = validateRestore(t, ledger);
    if (error) {
      result = { ok: false, error };
      return;
    }
    await db.runAsync(
      `INSERT INTO transactions (id, scope, kind, amount, date, account_id, to_account_id, category_id, note, created_at, recurring_id, recurring_due, channel, channel_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      t.id, t.scope, t.kind, t.amount, t.date, t.account_id, t.to_account_id, t.category_id, t.note, t.created_at,
      t.recurring_id ?? null, t.recurring_due ?? null, t.channel ?? null, t.channel_id ?? null,
    );
    const r = deleted.recurring;
    if (r) await db.runAsync('UPDATE recurring_payments SET next_due_date = ? WHERE id = ? AND next_due_date = ?', r.before, r.id, r.after);
    result = { ok: true };
  });
  return result;
}

// ---------- Tienda: inversión y venta ----------

/** Crea (sin `id`) o edita un registro de la tienda (el tipo no cambia; created_at se conserva). */
export async function saveRecord(
  db: SQLiteDatabase,
  input: RecordInput,
  id?: string,
  newId: string = randomUUID(),
): Promise<{ ok: true } | { ok: false; errors: RecordErrors }> {
  let result: { ok: true } | { ok: false; errors: RecordErrors } = { ok: false, errors: {} };
  await db.withTransactionAsync(async () => {
    const { accounts, transactions, channels } = await loadLedger(db);
    const original = id ? transactions.find((t) => t.id === id) : undefined;
    if (id && !original) throw new Error('El registro ya no existe.');
    const checked = validateRecord(input, { accounts, transactions, channels, today: todayLocal() }, original);
    if (!checked.ok) {
      result = checked;
      return;
    }
    const t = checked.tx;
    if (original) {
      await db.runAsync(
        "UPDATE transactions SET amount = ?, date = ?, account_id = ?, note = ?, channel_id = ? WHERE id = ? AND scope = 'business' AND kind = ?",
        t.amount, t.date, t.account_id, t.note, t.channel_id, original.id, original.kind,
      );
    } else await insertTransaction(db, newId, t);
    result = { ok: true };
  });
  return result;
}

// ---------- Edición de cuentas y categorías ----------
// Cada operación lee y escribe en una sola transacción; un id inexistente lanza Error (la pantalla lo muestra).

type Done = { ok: true } | { ok: false; error: string };

async function guarded(db: SQLiteDatabase, run: (ledger: Ledger) => Promise<Done>): Promise<Done> {
  let result: Done = { ok: false, error: '' };
  await db.withTransactionAsync(async () => {
    result = await run(await loadLedger(db));
  });
  return result;
}

function found<T extends { id: string }>(items: readonly T[], id: string, what: string): T {
  const item = items.find((i) => i.id === id);
  if (!item) throw new Error(`${what} ya no existe.`);
  return item;
}

export async function updateAccount(
  db: SQLiteDatabase,
  id: string,
  input: AccountInput,
): Promise<{ ok: true } | { ok: false; errors: AccountErrors }> {
  let result: { ok: true } | { ok: false; errors: AccountErrors } = { ok: false, errors: {} };
  await db.withTransactionAsync(async () => {
    const { accounts, transactions } = await loadLedger(db);
    const errors = validateAccountEdit(input, found(accounts, id, 'La cuenta'), transactions);
    if (Object.keys(errors).length > 0) {
      result = { ok: false, errors };
      return;
    }
    // El scope no se escribe: no cambia nunca.
    await db.runAsync(
      'UPDATE accounts SET name = ?, type = ?, opening_balance = ?, allow_negative = ? WHERE id = ?',
      input.name.trim(), input.type, input.openingBalance, input.allowNegative ? 1 : 0, id,
    );
    result = { ok: true };
  });
  return result;
}

export function setAccountArchived(db: SQLiteDatabase, id: string, archived: boolean): Promise<Done> {
  return guarded(db, async ({ accounts, transactions, recurring }) => {
    found(accounts, id, 'La cuenta');
    const error = archived
      ? (canArchiveAccount(accountBalances(accounts, transactions).get(id) ?? 0) ?? usedByActiveRecurring(id, recurring))
      : null;
    if (error) return { ok: false, error };
    await db.runAsync('UPDATE accounts SET archived = ? WHERE id = ?', archived ? 1 : 0, id);
    return { ok: true };
  });
}

export function deleteAccount(db: SQLiteDatabase, id: string): Promise<Done> {
  return guarded(db, async ({ accounts, transactions, recurring }) => {
    found(accounts, id, 'La cuenta');
    const error = canDeleteAccount(id, transactions) ?? usedByAnyRecurring(id, recurring);
    if (error) return { ok: false, error };
    await db.runAsync('DELETE FROM accounts WHERE id = ?', id);
    return { ok: true };
  });
}

/** Categoría personal nueva (las de la tienda son fijas). */
type Style = { icon: IconKey; color: ColorKey };
const styleError = ({ icon, color }: Style) => (isIconKey(icon) && isColorKey(color) ? null : 'Elige un ícono y un color de la lista.');

export function createCategory(
  db: SQLiteDatabase,
  name: string,
  kind: Category['kind'],
  style: Style,
  id: string = randomUUID(),
): Promise<Done> {
  return guarded(db, async ({ categories }) => {
    const error = validateCategoryName(name, kind, categories) ?? styleError(style);
    if (error) return { ok: false, error };
    await db.runAsync(
      "INSERT INTO categories (id, scope, kind, name, icon, color) VALUES (?, 'personal', ?, ?, ?, ?)",
      id, kind, name.trim(), style.icon, style.color,
    );
    return { ok: true };
  });
}

/** Nombre, ícono y color (Nómina: solo ícono y color). */
export function updateCategory(db: SQLiteDatabase, id: string, name: string, style: Style): Promise<Done> {
  return guarded(db, async ({ categories }) => {
    const c = found(categories, id, 'La categoría');
    const error = validateCategoryName(name, c.kind, categories, id, c.scope) ?? styleError(style);
    if (error) return { ok: false, error };
    await db.runAsync('UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ?', name.trim(), style.icon, style.color, id);
    return { ok: true };
  });
}

export function setCategoryArchived(db: SQLiteDatabase, id: string, archived: boolean): Promise<Done> {
  return guarded(db, async ({ categories, recurring }) => {
    found(categories, id, 'La categoría');
    const error = archived ? (canArchiveCategory(id) ?? usedByActiveRecurring(id, recurring)) : null;
    if (error) return { ok: false, error };
    await db.runAsync('UPDATE categories SET archived = ? WHERE id = ?', archived ? 1 : 0, id);
    return { ok: true };
  });
}

export function deleteCategory(db: SQLiteDatabase, id: string): Promise<Done> {
  return guarded(db, async ({ categories, transactions, recurring }) => {
    found(categories, id, 'La categoría');
    const error = canDeleteCategory(id, transactions) ?? usedByAnyRecurring(id, recurring);
    if (error) return { ok: false, error };
    // Su presupuesto (si tiene) se va con ella, en la misma transacción.
    await db.runAsync('DELETE FROM budgets WHERE category_id = ?', id);
    await db.runAsync('DELETE FROM categories WHERE id = ?', id);
    return { ok: true };
  });
}

// ---------- Presupuestos ----------
// Un monto por categoría para todos los meses: editarlo cambia también cómo se ven los meses anteriores.

export async function saveBudget(
  db: SQLiteDatabase,
  input: BudgetInput,
  id?: string,
): Promise<{ ok: true } | { ok: false; errors: BudgetErrors }> {
  let result: { ok: true } | { ok: false; errors: BudgetErrors } = { ok: false, errors: {} };
  await db.withTransactionAsync(async () => {
    const { categories, budgets } = await loadLedger(db);
    if (id) found(budgets, id, 'El presupuesto');
    const errors = validateBudget(input, { categories, budgets }, id);
    if (Object.keys(errors).length > 0) {
      result = { ok: false, errors };
      return;
    }
    if (id) {
      await db.runAsync('UPDATE budgets SET category_id = ?, amount = ?, alert_pct = ? WHERE id = ?', input.categoryId, input.amount, input.alertPct, id);
    } else {
      await db.runAsync(
        'INSERT INTO budgets (id, category_id, amount, alert_pct, created_at) VALUES (?, ?, ?, ?, ?)',
        randomUUID(), input.categoryId, input.amount, input.alertPct, new Date().toISOString(),
      );
    }
    result = { ok: true };
  });
  return result;
}

export function deleteBudget(db: SQLiteDatabase, id: string): Promise<Done> {
  return guarded(db, async ({ budgets }) => {
    found(budgets, id, 'El presupuesto');
    await db.runAsync('DELETE FROM budgets WHERE id = ?', id);
    return { ok: true };
  });
}

// ---------- Pagos recurrentes ----------
// La plantilla no afecta el saldo; confirmarla crea el gasto real y avanza la próxima cuota, todo en una transacción.

/** Crear o editar (`id`). Editar la fecha reinicia el ancla (las cuotas siguientes salen de esa fecha). `newId`: solo datos [PRUEBA]. */
export async function saveRecurring(
  db: SQLiteDatabase,
  input: RecurringInput,
  id?: string,
  newId: string = randomUUID(),
): Promise<{ ok: true } | { ok: false; errors: RecurringErrors }> {
  let result: { ok: true } | { ok: false; errors: RecurringErrors } = { ok: false, errors: {} };
  await db.withTransactionAsync(async () => {
    const { accounts, categories, recurring } = await loadLedger(db);
    if (id) found(recurring, id, 'El pago recurrente');
    const errors = validateRecurring(input, { accounts, categories });
    if (Object.keys(errors).length > 0) {
      result = { ok: false, errors };
      return;
    }
    const date = input.frequency === 'biweekly' ? toBiweeklyDate(input.firstDate) : input.firstDate;
    const values = [input.concept.trim(), input.estimatedAmount, input.frequency, date, date, input.accountId, input.categoryId];
    if (id) {
      await db.runAsync(
        `UPDATE recurring_payments SET concept = ?, estimated_amount = ?, frequency = ?, anchor_date = ?, next_due_date = ?,
         account_id = ?, category_id = ? WHERE id = ?`,
        ...values, id,
      );
    } else {
      await db.runAsync(
        `INSERT INTO recurring_payments (id, concept, estimated_amount, frequency, anchor_date, next_due_date, account_id, category_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        newId, ...values, new Date().toISOString(),
      );
    }
    result = { ok: true };
  });
  return result;
}

export function setRecurringActive(db: SQLiteDatabase, id: string, active: boolean): Promise<Done> {
  return guarded(db, async ({ recurring }) => {
    found(recurring, id, 'El pago recurrente');
    await db.runAsync('UPDATE recurring_payments SET active = ? WHERE id = ?', active ? 1 : 0, id);
    return { ok: true };
  });
}

/** Los gastos ya pagados se conservan (quedan sin enlace a la plantilla). */
export function deleteRecurring(db: SQLiteDatabase, id: string): Promise<Done> {
  return guarded(db, async ({ recurring }) => {
    found(recurring, id, 'El pago recurrente');
    await db.runAsync('UPDATE transactions SET recurring_id = NULL WHERE recurring_id = ?', id);
    await db.runAsync('DELETE FROM recurring_payments WHERE id = ?', id);
    return { ok: true };
  });
}

/** Paga la cuota actual: crea el gasto real (monto real) validado como cualquier gasto y avanza la próxima cuota. */
export async function confirmRecurring(
  db: SQLiteDatabase,
  recurringId: string,
  input: MovementInput,
  id: string = randomUUID(),
): Promise<{ ok: true; id: string } | { ok: false; errors: MovementErrors }> {
  let result: { ok: true; id: string } | { ok: false; errors: MovementErrors } = { ok: false, errors: {} };
  await db.withTransactionAsync(async () => {
    const { accounts, categories, transactions, recurring } = await loadLedger(db);
    const item = found(recurring, recurringId, 'El pago recurrente');
    if (input.kind !== 'expense') {
      result = { ok: false, errors: { kind: 'Un pago recurrente se registra como gasto.' } };
      return;
    }
    const checked = validateMovement(input, { accounts, categories, transactions, today: todayLocal() });
    if (!checked.ok) {
      result = checked;
      return;
    }
    await insertTransaction(db, id, checked.tx, { recurringId: item.id, due: item.next_due_date });
    await db.runAsync(
      'UPDATE recurring_payments SET next_due_date = ? WHERE id = ?',
      followingDue(item.anchor_date, item.next_due_date, item.frequency), item.id,
    );
    result = { ok: true, id };
  });
  return result;
}

/** Omitir la cuota actual: avanza la fecha sin crear ningún gasto. */
export function skipRecurring(db: SQLiteDatabase, id: string): Promise<Done> {
  return guarded(db, async ({ recurring }) => {
    const item = found(recurring, id, 'El pago recurrente');
    await db.runAsync(
      'UPDATE recurring_payments SET next_due_date = ? WHERE id = ?',
      followingDue(item.anchor_date, item.next_due_date, item.frequency), id,
    );
    return { ok: true };
  });
}

// ---------- Canales de venta de la tienda ----------

/** Canal nuevo al final de la lista. */
export async function createChannel(db: SQLiteDatabase, name: string, id: string = randomUUID()): Promise<Done> {
  return guarded(db, async ({ channels }) => {
    const v = validateChannelName(name, channels);
    if (!v.ok) return v;
    const order = Math.max(-1, ...channels.map((c) => c.sort_order)) + 1;
    await db.runAsync('INSERT INTO channels (id, name, sort_order) VALUES (?, ?, ?)', id, v.name, order);
    return { ok: true };
  });
}

export async function renameChannel(db: SQLiteDatabase, id: string, name: string): Promise<Done> {
  return guarded(db, async ({ channels }) => {
    found(channels, id, 'El canal');
    const v = validateChannelName(name, channels, id);
    if (!v.ok) return v;
    await db.runAsync('UPDATE channels SET name = ? WHERE id = ?', v.name, id);
    return { ok: true };
  });
}

export async function setChannelArchived(db: SQLiteDatabase, id: string, archived: boolean): Promise<Done> {
  return guarded(db, async ({ channels, transactions }) => {
    found(channels, id, 'El canal');
    if (archived && !channelRemoval(id, channels, transactions).canArchive) return { ok: false, error: 'Debe quedar al menos un canal activo.' };
    await db.runAsync('UPDATE channels SET archived = ? WHERE id = ?', archived ? 1 : 0, id);
    return { ok: true };
  });
}

/** Solo sin ventas (si tiene, se archiva) y nunca el último activo. */
export async function deleteChannel(db: SQLiteDatabase, id: string): Promise<Done> {
  return guarded(db, async ({ channels, transactions }) => {
    found(channels, id, 'El canal');
    if (!channelRemoval(id, channels, transactions).canDelete) {
      return { ok: false, error: transactions.some((t) => t.channel_id === id) ? 'Este canal tiene ventas: archívalo.' : 'Debe quedar al menos un canal activo.' };
    }
    await db.runAsync('DELETE FROM channels WHERE id = ?', id);
    return { ok: true };
  });
}

/** Guarda el orden de la lista (ids en el orden nuevo). */
export async function reorderChannels(db: SQLiteDatabase, ids: readonly string[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const [i, id] of ids.entries()) await db.runAsync('UPDATE channels SET sort_order = ? WHERE id = ?', i, id);
  });
}
