// Datos de los gráficos del Panel. TS puro; los porcentajes son solo para dibujar.
import { DEFAULT_COLOR, type ColorKey, type IconKey } from './category-style';
import type { Category, Transaction } from './ledger';
import { sum } from './money';
import { lastMonths, type Range } from './periods';
import { isPersonalExpense, isPersonalIncome } from './summary';

export type Slice = { key: string; label: string; amount: number; icon: IconKey; color: ColorKey; share: number };

/**
 * Gastos personales del rango por categoría, de mayor a menor. Más de `max` categorías → las `max` mayores + "Otros".
 * La suma de los importes es igual al gasto del resumen. Sin gastos → [] (la UI muestra "No disponible").
 */
export function expensesByCategory(txs: readonly Transaction[], categories: readonly Category[], { from, to }: Range, max = 5): Slice[] {
  const byCategory = new Map<string, number>();
  for (const t of txs) {
    if (isPersonalExpense(t) && t.date >= from && t.date <= to) {
      byCategory.set(t.category_id ?? '', sum([byCategory.get(t.category_id ?? '') ?? 0, t.amount]));
    }
  }
  const total = sum([...byCategory.values()]);
  if (total === 0) return [];
  const slice = (key: string, amount: number): Slice => {
    const c = categories.find((x) => x.id === key);
    return { key, label: c?.name ?? 'Sin categoría', amount, icon: c?.icon ?? 'tag', color: c?.color ?? DEFAULT_COLOR, share: amount / total };
  };
  const sorted = [...byCategory].map(([id, amount]) => slice(id, amount)).sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label, 'es'));
  if (sorted.length <= max + 1) return sorted; // "Otros" con una sola categoría no aporta nada
  const rest = sum(sorted.slice(max).map((s) => s.amount));
  return [...sorted.slice(0, max), { key: 'others', label: 'Otros', amount: rest, icon: 'more', color: DEFAULT_COLOR, share: rest / total }];
}

export type MonthTotals = { month: string; label: string; income: number; expense: number };

/** Ingresos y gastos personales de los últimos `months` meses de calendario (el actual hasta hoy), del más antiguo al actual. */
export function monthlyTotals(txs: readonly Transaction[], today: string, months = 6): MonthTotals[] {
  return lastMonths(today, months).map(({ from, to, month, label }) => {
    const inMonth = txs.filter((t) => t.date >= from && t.date <= to);
    return {
      month,
      label,
      income: sum(inMonth.filter(isPersonalIncome).map((t) => t.amount)),
      expense: sum(inMonth.filter(isPersonalExpense).map((t) => t.amount)),
    };
  });
}
