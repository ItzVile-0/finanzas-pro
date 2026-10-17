// Resumen personal de un periodo (ingresos personales).
import { isValidISODate } from './dates';
import { accountBalances, PAYROLL_CATEGORY_ID, type Account, type Category, type Transaction } from './ledger';
import { sum } from './money';
import type { Range } from './periods';

/** Ingreso personal: income personal. Las ventas de la tienda nunca son ingreso personal. Compartido con los gráficos. */
export const isPersonalIncome = (t: Pick<Transaction, 'scope' | 'kind'>) => t.scope === 'personal' && t.kind === 'income';
/** Gasto personal: expense personal. Las inversiones de la tienda nunca son gasto personal. */
export const isPersonalExpense = (t: Pick<Transaction, 'scope' | 'kind'>) => t.scope === 'personal' && t.kind === 'expense';

export type IncomeLine = { key: string; label: string; amount: number };

/**
 * - Saldo total: todas las cuentas no archivadas, con TODO lo registrado, también la tienda (el periodo no lo cambia).
 * - Ingresos del periodo = income personal; desglose Nómina / resto por categoría, sin filas en 0.
 * - Gastos del periodo = expense personal.
 * - Transferencias propias no cuentan. Inversiones y ventas de la tienda no entran en ingresos ni gastos.
 * @param range rango cerrado [from, to] por fecha contable.
 */
export function personalSummary(
  accounts: readonly Account[],
  categories: readonly Category[],
  txs: readonly Transaction[],
  { from, to }: Range,
) {
  if (!isValidISODate(from) || !isValidISODate(to) || from > to) throw new Error(`Rango inválido: ${from} … ${to}`);
  const balances = accountBalances(accounts, txs);
  const personalAccounts = accounts.filter((a) => !a.archived);
  const inRange = txs.filter((t) => t.date >= from && t.date <= to);
  const amountOf = (pred: (t: Transaction) => boolean) => sum(inRange.filter(pred).map((t) => t.amount));

  const personalIncome = inRange.filter((t) => t.scope === 'personal' && t.kind === 'income');
  const byCategory = new Map<string, number>();
  for (const t of personalIncome) {
    if (t.category_id !== PAYROLL_CATEGORY_ID) {
      byCategory.set(t.category_id ?? '', sum([byCategory.get(t.category_id ?? '') ?? 0, t.amount]));
    }
  }
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Sin categoría';

  const lines: IncomeLine[] = [
    { key: 'payroll', label: 'Nómina', amount: amountOf((t) => t.scope === 'personal' && t.kind === 'income' && t.category_id === PAYROLL_CATEGORY_ID) },
    ...[...byCategory].map(([id, amount]) => ({ key: id, label: categoryName(id), amount })).sort((a, b) => b.amount - a.amount),
  ];

  const income = sum(lines.map((l) => l.amount));
  const expense = amountOf(isPersonalExpense);
  const share = incomeShare(income, expense);

  return {
    total: sum(personalAccounts.map((a) => balances.get(a.id) ?? 0)),
    accounts: personalAccounts.map((a) => ({ ...a, balance: balances.get(a.id) ?? 0 })),
    income,
    expense,
    net: sum([income, -expense]),
    incomeLines: lines.filter((l) => l.amount > 0),
    savingsPct: savingsPercent(income, expense),
    incomeShare: share,
    barPct: share === null ? null : { income: Math.round(share * 100), expense: 100 - Math.round(share * 100) },
  };
}

/** (ingresos − gastos) / ingresos × 100, entero. null = "No disponible" (ingresos 0). Puede ser negativo. */
export function savingsPercent(income: number, expense: number): number | null {
  if (income <= 0) return null;
  return Math.round(((income - expense) / income) * 100);
}

/** Fracción 0..1 de ingresos frente a ingresos + gastos, para la barra. null si ambos son 0. */
export function incomeShare(income: number, expense: number): number | null {
  const total = income + expense;
  return total > 0 ? income / total : null;
}

/** % de cambio frente al anterior, entero. null = "No disponible" (anterior 0). Sobre |anterior| para que el signo diga si subió. */
export function changePercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

export type PeriodTotals = { income: number; expense: number; net: number; savingsPct: number | null };

const periodTotals = (txs: readonly Transaction[], { from, to }: Range): PeriodTotals => {
  const inRange = txs.filter((t) => t.date >= from && t.date <= to);
  const income = sum(inRange.filter(isPersonalIncome).map((t) => t.amount));
  const expense = sum(inRange.filter(isPersonalExpense).map((t) => t.amount));
  return { income, expense, net: income - expense, savingsPct: savingsPercent(income, expense) };
};

/** Ingresos, gastos y ahorro personales del periodo frente al anterior (solo scope personal; transferencias y la tienda no cuentan). */
export function periodComparison(txs: readonly Transaction[], current: Range, previous: Range) {
  const now = periodTotals(txs, current);
  const before = periodTotals(txs, previous);
  return {
    current: now,
    previous: before,
    change: {
      income: changePercent(now.income, before.income),
      expense: changePercent(now.expense, before.expense),
      net: changePercent(now.net, before.net),
    },
  };
}
