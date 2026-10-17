// Pagos recurrentes: una plantilla NO afecta el saldo; solo al confirmarla se crea el gasto real.
import { daysInMonth } from './calendar';
import { addDays, daysBetween, formatShortDate, isValidISODate } from './dates';
import type { Account, Category, Transaction } from './ledger';

export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly';
export const FREQUENCIES: Frequency[] = ['monthly', 'biweekly', 'weekly', 'yearly'];
export const FREQUENCY_LABEL: Record<Frequency, string> = { monthly: 'Mensual', biweekly: 'Quincenal', weekly: 'Semanal', yearly: 'Anual' };

export type Recurring = {
  id: string;
  scope: 'personal' | 'business';
  concept: string;
  estimated_amount: number;
  frequency: Frequency;
  /** Primera cuota: de ella sale el día del mes (un pago del 31 vuelve al 31 después de febrero). */
  anchor_date: string;
  next_due_date: string;
  account_id: string;
  category_id: string;
  active: boolean;
};

const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (ym: string) => `${ym}-${pad(daysInMonth(ym))}`;
const nextMonth = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
};
/** Día `day` del mes, sin pasarse del último (31 → 30 en abril, 28/29 en febrero). */
const clampDay = (ym: string, day: number) => `${ym}-${pad(Math.min(day, daysInMonth(ym)))}`;

/** Quincenas colombianas: el 15 y el último día del mes. Una fecha que no lo es pasa a la quincena siguiente. */
export function toBiweeklyDate(iso: string): string {
  if (!isValidISODate(iso)) throw new Error(`Fecha inválida: ${iso}`);
  const ym = iso.slice(0, 7);
  const day = Number(iso.slice(8));
  if (day <= 15) return `${ym}-15`;
  return lastDay(ym);
}

/** La cuota que sigue a `current`. */
export function followingDue(anchor: string, current: string, frequency: Frequency): string {
  if (!isValidISODate(anchor) || !isValidISODate(current)) throw new Error(`Fecha inválida: ${anchor} / ${current}`);
  const ym = current.slice(0, 7);
  switch (frequency) {
    case 'weekly':
      return addDays(current, 7);
    case 'biweekly':
      return Number(current.slice(8)) === 15 ? lastDay(ym) : `${nextMonth(ym)}-15`;
    case 'monthly':
      return clampDay(nextMonth(ym), Number(anchor.slice(8)));
    case 'yearly':
      return clampDay(`${Number(current.slice(0, 4)) + 1}-${anchor.slice(5, 7)}`, Number(anchor.slice(8)));
  }
}

export type RecurringStatus = 'overdue' | 'paid' | 'pending';

/**
 * Vencido: la próxima cuota ya pasó. Pagado: la cuota anterior a la próxima se pagó (no se omitió).
 * Pendiente: lo demás (primera cuota, o la anterior se omitió).
 */
export function recurringStatus(item: Recurring, today: string, lastPaidDue: string | null): RecurringStatus {
  if (item.next_due_date < today) return 'overdue';
  if (lastPaidDue && followingDue(item.anchor_date, lastPaidDue, item.frequency) === item.next_due_date) return 'paid';
  return 'pending';
}

/** Última cuota pagada con un gasto real (las omitidas no cuentan), o null. */
export function lastPaidDue(id: string, transactions: readonly Transaction[]): string | null {
  let last: string | null = null;
  for (const t of transactions) if (t.recurring_id === id && t.recurring_due && (!last || t.recurring_due > last)) last = t.recurring_due;
  return last;
}

/** Texto de la próxima cuota para las filas: "Venció hace 3 días", "Vence hoy", "Vence en 4 días", "Pagado · próximo 14 nov". */
export function dueText(item: Recurring, today: string, lastPaid: string | null): string {
  const due = item.next_due_date;
  const status = recurringStatus(item, today, lastPaid);
  if (status === 'overdue') {
    const late = daysBetween(due, today);
    return late === 1 ? 'Venció ayer' : `Venció hace ${late} días`;
  }
  if (status === 'paid') return `Pagado · próximo ${formatShortDate(due)}`;
  const left = daysBetween(today, due);
  if (left === 0) return 'Vence hoy';
  if (left === 1) return 'Vence mañana';
  return left <= 7 ? `Vence en ${left} días` : `Vence el ${formatShortDate(due)}`;
}

/** Activos vencidos o con cuota en los próximos `days` días, por fecha (tarjeta "Próximos pagos"). */
export function upcoming(items: readonly Recurring[], today: string, days = 7): Recurring[] {
  const limit = addDays(today, days);
  return items.filter((r) => r.active && r.next_due_date <= limit).sort((a, b) => a.next_due_date.localeCompare(b.next_due_date));
}

export type RecurringInput = {
  concept: string;
  estimatedAmount: number;
  frequency: Frequency;
  firstDate: string;
  accountId: string;
  categoryId: string;
};
export type RecurringErrors = Partial<Record<keyof RecurringInput, string>>;

/** Plantilla de gasto personal. La fecha puede ser futura; en quincenal debe ser 15 o fin de mes (el formulario la ajusta). */
export function validateRecurring(input: RecurringInput, ctx: { accounts: readonly Account[]; categories: readonly Category[] }): RecurringErrors {
  const errors: RecurringErrors = {};
  const concept = input.concept.trim();
  if (!concept) errors.concept = 'Escribe el concepto.';
  else if (concept.length > 60) errors.concept = 'Máximo 60 caracteres.';
  if (!Number.isSafeInteger(input.estimatedAmount) || input.estimatedAmount <= 0) errors.estimatedAmount = 'El monto debe ser un entero mayor que 0.';
  if (!FREQUENCIES.includes(input.frequency)) errors.frequency = 'Elige la frecuencia.';
  if (!isValidISODate(input.firstDate)) errors.firstDate = 'Fecha inválida.';
  else if (input.frequency === 'biweekly' && toBiweeklyDate(input.firstDate) !== input.firstDate) {
    errors.firstDate = 'En quincenal la fecha es el 15 o el último día del mes.';
  }
  const account = ctx.accounts.find((a) => a.id === input.accountId);
  if (!account || account.archived || account.scope !== 'personal') errors.accountId = 'Elige una cuenta personal.';
  const cat = ctx.categories.find((c) => c.id === input.categoryId);
  if (!cat || cat.archived || cat.kind !== 'expense' || cat.scope !== 'personal') errors.categoryId = 'Elige una categoría de gastos.';
  return errors;
}

export const IN_USE_BY_RECURRING = 'La usa un pago recurrente activo: páusalo o cámbialo antes de archivar.';

/** Una cuenta o categoría usada por un recurrente ACTIVO no se archiva. */
export function usedByActiveRecurring(id: string, items: readonly Recurring[]): string | null {
  return items.some((r) => r.active && (r.account_id === id || r.category_id === id)) ? IN_USE_BY_RECURRING : null;
}

export const DELETE_USED_BY_RECURRING = 'La usa un pago recurrente: elimínalo o cámbialo antes.';

/** Para eliminar: ningún recurrente (activo o pausado) puede quedar apuntando a la cuenta o categoría. */
export function usedByAnyRecurring(id: string, items: readonly Recurring[]): string | null {
  return items.some((r) => r.account_id === id || r.category_id === id) ? DELETE_USED_BY_RECURRING : null;
}

/**
 * Al eliminar el gasto que pagó la cuota `paidDue`: si era la última pagada (la próxima es justo la siguiente),
 * la plantilla vuelve a esa cuota y queda pendiente otra vez. Si no, null (no se toca la plantilla).
 */
export function dueAfterUndo(item: Recurring, paidDue: string): string | null {
  return followingDue(item.anchor_date, paidDue, item.frequency) === item.next_due_date ? paidDue : null;
}
