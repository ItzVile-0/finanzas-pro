import { budgetAlerts, budgetStatus, budgetStatuses, validateBudget, type Budget } from './budgets';
import type { Category, Transaction } from './ledger';

const cat = (id: string, o: Partial<Category> = {}): Category => ({
  id, scope: 'personal', kind: 'expense', name: id, archived: false, icon: 'cart', color: 'green', ...o,
});
const categories = [cat('mercado'), cat('ocio'), cat('salud'), cat('vieja', { archived: true }), cat('nomina', { kind: 'income' })];
const budget = (category_id: string, amount: number, alert_pct = 80): Budget => ({ id: `b-${category_id}`, category_id, amount, alert_pct });

let n = 0;
const tx = (category_id: string, amount: number, o: Partial<Transaction> = {}): Transaction => ({
  id: `t${++n}`, scope: 'personal', kind: 'expense', amount, date: '2026-10-10', account_id: 'banco', to_account_id: null,
  category_id, note: '', created_at: '', ...o,
});

describe('budgetStatus', () => {
  it('suma solo los gastos personales del mes y de la categoría', () => {
    const txs = [
      tx('mercado', 300_000),
      tx('mercado', 100_000, { date: '2026-10-31' }),
      tx('mercado', 999_000, { date: '2026-09-30' }), // mes anterior
      tx('mercado', 999_000, { date: '2026-11-01' }), // mes siguiente
      tx('ocio', 50_000), // otra categoría
      tx('mercado', 888_000, { scope: 'business' }), // inversión de la tienda: nunca gasto personal
    ];
    const s = budgetStatus(budget('mercado', 1_000_000), txs, '2026-10');
    expect([s.spent, s.remaining, s.pct, s.level]).toEqual([400_000, 600_000, 40, 'ok']);
  });

  it('umbral exacto = alerta; pasarse del 100 % = over con restante negativo', () => {
    expect(budgetStatus(budget('mercado', 1_000_000), [tx('mercado', 799_999)], '2026-10').level).toBe('ok');
    expect(budgetStatus(budget('mercado', 1_000_000), [tx('mercado', 800_000)], '2026-10').level).toBe('alert');
    expect(budgetStatus(budget('mercado', 1_000_000), [tx('mercado', 1_000_000)], '2026-10').level).toBe('alert');
    const over = budgetStatus(budget('mercado', 1_000_000), [tx('mercado', 1_250_000)], '2026-10');
    expect([over.level, over.remaining, over.pct]).toEqual(['over', -250_000, 125]);
  });

  it('umbral configurable (50 %) y mes inválido', () => {
    expect(budgetStatus(budget('mercado', 100_000, 50), [tx('mercado', 50_000)], '2026-10').level).toBe('alert');
    expect(() => budgetStatus(budget('mercado', 100_000), [], '2026-1')).toThrow();
  });
});

describe('budgetStatuses y budgetAlerts', () => {
  const budgets = [budget('mercado', 1_000_000), budget('ocio', 100_000), budget('salud', 200_000), budget('vieja', 50_000)];
  const txs = [tx('mercado', 850_000), tx('ocio', 150_000), tx('salud', 20_000), tx('vieja', 999_000)];

  it('del más consumido al menos; las categorías archivadas no aparecen', () => {
    expect(budgetStatuses(budgets, categories, txs, '2026-10').map((s) => [s.budget.category_id, s.level])).toEqual([
      ['ocio', 'over'],
      ['mercado', 'alert'],
      ['salud', 'ok'],
    ]);
  });

  it('alertas = solo los que llegaron al umbral o se pasaron', () => {
    expect(budgetAlerts(budgets, categories, txs, '2026-10').map((s) => s.budget.category_id)).toEqual(['ocio', 'mercado']);
    expect(budgetAlerts(budgets, categories, txs, '2026-11')).toEqual([]);
  });
});

describe('validateBudget', () => {
  const ctx = { categories, budgets: [budget('mercado', 1_000)] };
  it('acepta uno válido y la edición del propio', () => {
    expect(validateBudget({ categoryId: 'ocio', amount: 200_000, alertPct: 80 }, ctx)).toEqual({});
    expect(validateBudget({ categoryId: 'mercado', amount: 2_000, alertPct: 90 }, ctx, 'b-mercado')).toEqual({});
  });

  it('rechaza categoría repetida, archivada o de ingreso; monto ≤ 0 o decimal; umbral fuera de 1–100', () => {
    expect(validateBudget({ categoryId: 'mercado', amount: 1, alertPct: 80 }, ctx).categoryId).toMatch(/ya tiene/);
    expect(validateBudget({ categoryId: 'vieja', amount: 1, alertPct: 80 }, ctx).categoryId).toBeDefined();
    expect(validateBudget({ categoryId: 'nomina', amount: 1, alertPct: 80 }, ctx).categoryId).toMatch(/gastos/);
    expect(validateBudget({ categoryId: 'ocio', amount: 0, alertPct: 80 }, ctx).amount).toBeDefined();
    expect(validateBudget({ categoryId: 'ocio', amount: 1.5, alertPct: 80 }, ctx).amount).toBeDefined();
    for (const alertPct of [0, 101, 80.5]) expect(validateBudget({ categoryId: 'ocio', amount: 1, alertPct }, ctx).alertPct).toBeDefined();
  });
});
