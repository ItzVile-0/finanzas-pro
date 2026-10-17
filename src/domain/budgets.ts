// Presupuestos mensuales por categoría de gasto. Un monto por categoría que aplica a TODOS los meses:
// editarlo cambia también cómo se ven los meses anteriores. alert_pct es un ajuste del usuario; el % consumido se calcula.
import type { Category, Transaction } from './ledger';
import { sum } from './money';
import { isPersonalExpense } from './summary';

export type Budget = { id: string; category_id: string; amount: number; alert_pct: number };
export type BudgetInput = { categoryId: string; amount: number; alertPct: number };
export type BudgetErrors = Partial<Record<keyof BudgetInput, string>>;
export type BudgetLevel = 'ok' | 'alert' | 'over';
export type BudgetStatus = { budget: Budget; category?: Category; spent: number; remaining: number; pct: number; level: BudgetLevel };

export const DEFAULT_ALERT_PCT = 80;

/** Para crear (sin id) o editar (con id). La categoría: de gasto, personal, activa y sin otro presupuesto. */
export function validateBudget(
  input: BudgetInput,
  ctx: { categories: readonly Category[]; budgets: readonly Budget[] },
  id?: string,
): BudgetErrors {
  const errors: BudgetErrors = {};
  const cat = ctx.categories.find((c) => c.id === input.categoryId);
  if (!cat || cat.archived) errors.categoryId = 'Elige una categoría.';
  else if (cat.kind !== 'expense' || cat.scope !== 'personal') errors.categoryId = 'Solo categorías de gastos personales.';
  else if (ctx.budgets.some((b) => b.category_id === cat.id && b.id !== id)) errors.categoryId = 'Esa categoría ya tiene presupuesto.';
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) errors.amount = 'El monto debe ser un entero mayor que 0.';
  if (!Number.isInteger(input.alertPct) || input.alertPct < 1 || input.alertPct > 100) {
    errors.alertPct = 'La alerta debe ser un porcentaje entero entre 1 y 100.';
  }
  return errors;
}

/** Gasto del mes ('YYYY-MM', fecha contable) frente al presupuesto. pct solo para mostrar. */
export function budgetStatus(budget: Budget, txs: readonly Transaction[], month: string, category?: Category): BudgetStatus {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error(`Mes inválido: ${month}`);
  const spent = sum(
    txs.filter((t) => isPersonalExpense(t) && t.category_id === budget.category_id && t.date.startsWith(`${month}-`)).map((t) => t.amount),
  );
  // Comparaciones en enteros (sin dividir): alerta al llegar al umbral; "over" al pasar del 100 %.
  const level: BudgetLevel = spent > budget.amount ? 'over' : spent * 100 >= budget.amount * budget.alert_pct ? 'alert' : 'ok';
  return { budget, category, spent, remaining: budget.amount - spent, pct: Math.round((spent * 100) / budget.amount), level };
}

/** Estado de todos los presupuestos de categorías activas, del más consumido al menos. */
export function budgetStatuses(
  budgets: readonly Budget[],
  categories: readonly Category[],
  txs: readonly Transaction[],
  month: string,
): BudgetStatus[] {
  return budgets
    .map((b) => budgetStatus(b, txs, month, categories.find((c) => c.id === b.category_id)))
    .filter((s) => s.category && !s.category.archived)
    .sort((a, b) => b.spent * a.budget.amount - a.spent * b.budget.amount); // spentB/amountB vs spentA/amountA, sin dividir
}

/** Solo los que llegaron a su umbral o se pasaron (tarjeta del Inicio, siempre el mes actual). */
export function budgetAlerts(
  budgets: readonly Budget[],
  categories: readonly Category[],
  txs: readonly Transaction[],
  month: string,
): BudgetStatus[] {
  return budgetStatuses(budgets, categories, txs, month).filter((s) => s.level !== 'ok');
}
