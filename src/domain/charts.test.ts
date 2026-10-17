import { expensesByCategory, monthlyTotals } from './charts';
import type { Account, Category, Transaction } from './ledger';
import { personalSummary } from './summary';

const accounts: Account[] = [
  { id: 'banco', scope: 'personal', name: '[PRUEBA] banco', type: 'bank', opening_balance: 10_000_000, allow_negative: false, archived: false },
  { id: 'caja', scope: 'business', name: '[PRUEBA] caja', type: 'cash', opening_balance: 0, allow_negative: false, archived: false },
];
const cat = (id: string, name: string, kind: Category['kind'] = 'expense'): Category => ({
  id, scope: 'personal', kind, name, archived: false, icon: 'cart', color: 'green',
});
const categories = [
  cat('nomina', 'Nómina', 'income'),
  ...['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((k) => cat(`cat-${k}`, `Categoría ${k.toUpperCase()}`)),
];

let n = 0;
const tx = (kind: Transaction['kind'], amount: number, o: Partial<Transaction> = {}): Transaction => ({
  id: `t${++n}`, scope: 'personal', kind, amount, date: '2026-10-05', account_id: 'banco', to_account_id: null,
  category_id: null, note: '', created_at: '', ...o,
});
const OCT = { from: '2026-10-01', to: '2026-10-31' };

describe('expensesByCategory', () => {
  const txs = [
    tx('expense', 700_000, { category_id: 'cat-a' }),
    tx('expense', 600_000, { category_id: 'cat-b' }),
    tx('expense', 500_000, { category_id: 'cat-c' }),
    tx('expense', 400_000, { category_id: 'cat-d' }),
    tx('expense', 300_000, { category_id: 'cat-e' }),
    tx('expense', 200_000, { category_id: 'cat-f' }),
    tx('expense', 100_000, { category_id: 'cat-g' }),
    tx('expense', 50_000, { category_id: 'cat-a', date: '2026-09-30' }), // fuera del rango
    tx('expense', 800_000, { scope: 'business', account_id: 'caja', category_id: 'cat-b-inversion' }), // inversión de la tienda
    tx('transfer', 999_000, { to_account_id: 'banco2' }),
  ];

  it('las 5 mayores + "Otros"; la suma es igual al gasto del resumen', () => {
    const slices = expensesByCategory(txs, categories, OCT);
    expect(slices.map((s) => [s.label, s.amount])).toEqual([
      ['Categoría A', 700_000],
      ['Categoría B', 600_000],
      ['Categoría C', 500_000],
      ['Categoría D', 400_000],
      ['Categoría E', 300_000],
      ['Otros', 300_000],
    ]);
    const total = slices.reduce((acc, s) => acc + s.amount, 0);
    expect(total).toBe(personalSummary(accounts, categories, txs, OCT).expense);
    expect(slices.reduce((acc, s) => acc + s.share, 0)).toBeCloseTo(1);
  });

  it('"Otros" solo si agrupa 2 o más; con 6 categorías se muestran todas', () => {
    expect(expensesByCategory(txs.slice(0, 6), categories, OCT).map((s) => s.label)).not.toContain('Otros');
  });

  it('sin gastos → [] (nunca NaN)', () => {
    expect(expensesByCategory([tx('income', 1_000, { category_id: 'nomina' })], categories, OCT)).toEqual([]);
    expect(expensesByCategory([], categories, OCT)).toEqual([]);
  });

  it('usa ícono y color de la categoría', () => {
    expect(expensesByCategory(txs.slice(0, 1), categories, OCT)[0]).toMatchObject({ icon: 'cart', color: 'green', share: 1 });
  });
});

describe('monthlyTotals', () => {
  it('últimos 6 meses cruzando de año, del más antiguo al actual; cuadra con el resumen de cada mes', () => {
    const txs = [
      tx('income', 3_000_000, { category_id: 'nomina', date: '2026-08-31' }),
      tx('income', 500_000, { scope: 'business', category_id: 'cat-b-venta', date: '2026-12-01' }), // venta de la tienda: no es ingreso personal
      tx('expense', 200_000, { category_id: 'cat-a', date: '2027-01-15' }),
      tx('expense', 999_000, { category_id: 'cat-a', date: '2027-01-16' }), // después de hoy: no entra
      tx('expense', 1_000, { category_id: 'cat-a', date: '2026-07-31' }), // antes del rango
    ];
    const months = monthlyTotals(txs, '2027-01-15');
    expect(months.map((m) => [m.month, m.label, m.income, m.expense])).toEqual([
      ['2026-08', 'ago', 3_000_000, 0],
      ['2026-09', 'sep', 0, 0],
      ['2026-10', 'oct', 0, 0],
      ['2026-11', 'nov', 0, 0],
      ['2026-12', 'dic', 0, 0],
      ['2027-01', 'ene', 0, 200_000],
    ]);
    const dec = personalSummary(accounts, categories, txs, { from: '2026-12-01', to: '2026-12-31' });
    expect([dec.income, dec.expense]).toEqual([months[4].income, months[4].expense]);
  });
});
