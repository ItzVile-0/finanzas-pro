import type { Account, Category, Transaction } from './ledger';
import { changePercent, incomeShare, periodComparison, personalSummary, savingsPercent } from './summary';

const acc = (id: string, scope: Account['scope'], opening: number): Account => ({
  id, scope, name: `[PRUEBA] ${id}`, type: 'bank', opening_balance: opening, allow_negative: false, archived: false,
});
const accounts = [acc('banco', 'personal', 1_000_000), acc('efectivo', 'personal', 200_000)];

const categories: Category[] = [
  { id: 'cat-p-nomina', scope: 'personal', kind: 'income', name: 'Nómina', archived: false, icon: 'tag', color: 'slate' },
  { id: 'cat-p-comisiones', scope: 'personal', kind: 'income', name: 'Comisiones', archived: false, icon: 'tag', color: 'slate' },
  { id: 'cat-p-ventas-personales', scope: 'personal', kind: 'income', name: 'Ventas personales', archived: false, icon: 'tag', color: 'slate' },
  { id: 'cat-p-alimentacion', scope: 'personal', kind: 'expense', name: 'Alimentación y mercado', archived: false, icon: 'tag', color: 'slate' },
];

let n = 0;
const tx = (kind: Transaction['kind'], amount: number, o: Partial<Transaction> = {}): Transaction => ({
  id: `t${++n}`, scope: 'personal', kind, amount, date: '2026-10-05', account_id: 'banco', to_account_id: null,
  category_id: null, note: '[PRUEBA]', created_at: '', ...o,
});

const OCT = { from: '2026-10-01', to: '2026-10-31' };
const txs: Transaction[] = [
  tx('income', 2_000_000, { category_id: 'cat-p-nomina' }),
  tx('income', 100_000, { category_id: 'cat-p-comisiones' }),
  tx('expense', 300_000, { category_id: 'cat-p-alimentacion' }),
  tx('transfer', 300_000, { to_account_id: 'efectivo' }),
  // La tienda en el banco: venta e inversión mueven el saldo, nunca ingresos ni gastos personales.
  tx('income', 700_000, { scope: 'business', category_id: 'cat-b-venta', channel: 'whatsapp' }),
  tx('expense', 40_000, { scope: 'business', category_id: 'cat-b-inversion' }),
  // Mes anterior: afecta saldos pero no "del mes".
  tx('income', 5_000_000, { category_id: 'cat-p-nomina', date: '2026-09-30' }),
  tx('expense', 1_000_000, { category_id: 'cat-p-alimentacion', date: '2026-09-15' }),
];

describe('personalSummary', () => {
  const s = personalSummary(accounts, categories, txs, OCT);

  it('saldo total = opening + todo lo registrado, también la tienda', () => {
    // banco: 1.000.000 + 2.000.000 + 100.000 − 300.000 − 300.000 + 700.000 − 40.000 + 5.000.000 − 1.000.000
    expect(s.accounts.find((a) => a.id === 'banco')!.balance).toBe(7_160_000);
    expect(s.accounts.find((a) => a.id === 'efectivo')!.balance).toBe(500_000);
    expect(s.total).toBe(7_660_000);
    expect(s.accounts.map((a) => a.id)).toEqual(['banco', 'efectivo']);
  });

  it('rango cerrado: incluye el primer y el último día; el saldo total no cambia con el periodo', () => {
    const borde = personalSummary(accounts, categories, txs, { from: '2026-09-30', to: '2026-10-05' });
    expect(borde.income).toBe(7_100_000);
    expect(personalSummary(accounts, categories, txs, { from: '2026-09-16', to: '2026-09-29' }).income).toBe(0);
    expect(personalSummary(accounts, categories, txs, { from: '2026-10-06', to: '2026-10-31' }).income).toBe(0);
    expect(borde.total).toBe(s.total);
  });

  it('del periodo: filtra por fecha contable', () => {
    expect(s.income).toBe(2_100_000);
    expect(s.expense).toBe(300_000);
    expect(personalSummary(accounts, categories, txs, { from: '2026-09-01', to: '2026-09-30' }).income).toBe(5_000_000);
    expect(personalSummary(accounts, categories, txs, { from: '2026-11-01', to: '2026-11-30' }).income).toBe(0);
  });

  it('ingresos = Nómina + resto por categoría, sin filas en 0 (sin la tienda)', () => {
    expect(s.incomeLines.map((l) => [l.label, l.amount])).toEqual([
      ['Nómina', 2_000_000],
      ['Comisiones', 100_000],
    ]);
    const onlyPayroll = personalSummary(accounts, categories, [txs[0]], OCT);
    expect(onlyPayroll.incomeLines.map((l) => l.label)).toEqual(['Nómina']);
  });

  it('5 y 6. inversión y venta de la tienda: no son gasto ni ingreso personal', () => {
    expect(s.expense).toBe(300_000);
    expect(s.income).toBe(2_100_000);
  });

  it('transferencia propia no es ingreso ni gasto', () => {
    const only = personalSummary(accounts, categories, [tx('transfer', 999_000, { to_account_id: 'efectivo' })], OCT);
    expect([only.income, only.expense, only.total]).toEqual([0, 0, 1_200_000]);
  });

  it('diferencia, ahorro y barra con porcentajes que suman 100', () => {
    expect(s.net).toBe(1_800_000);
    expect(s.savingsPct).toBe(86);
    expect(s.barPct).toEqual({ income: 88, expense: 12 });
  });

  it('sin movimientos: ahorro y barra no disponibles', () => {
    const e = personalSummary(accounts, categories, [], OCT);
    expect(e.savingsPct).toBeNull();
    expect(e.barPct).toBeNull();
    expect(e.incomeLines).toEqual([]);
  });

  it('rechaza rango mal formado o invertido e importes inválidos', () => {
    expect(() => personalSummary(accounts, categories, [], { from: '2026-10', to: '2026-10-31' })).toThrow();
    expect(() => personalSummary(accounts, categories, [], { from: '2026-10-31', to: '2026-10-01' })).toThrow();
    expect(() => personalSummary(accounts, categories, [tx('income', 0.5, { category_id: 'cat-p-nomina' })], OCT)).toThrow();
  });
});

describe('savingsPercent / incomeShare', () => {
  it('ingresos 0 → null, nunca NaN/Infinity', () => {
    expect(savingsPercent(0, 50_000)).toBeNull();
    expect(incomeShare(0, 0)).toBeNull();
  });
  it('negativo si se gasta más de lo que entra', () => {
    expect(savingsPercent(100_000, 150_000)).toBe(-50);
  });
});

describe('changePercent', () => {
  it('sube, baja y anterior 0 → No disponible (null)', () => {
    expect(changePercent(150, 100)).toBe(50);
    expect(changePercent(50, 100)).toBe(-50);
    expect(changePercent(100, 0)).toBeNull();
    expect(changePercent(0, 0)).toBeNull();
    expect(changePercent(-50, -100)).toBe(50); // ahorro negativo que mejora: sube
  });
});

describe('periodComparison', () => {
  it('solo personal, cada lado en su rango; transferencias y la tienda no cuentan', () => {
    const list = [
      tx('income', 2_000_000, { date: '2026-10-05' }),
      tx('expense', 500_000, { date: '2026-10-06' }),
      tx('income', 1_000_000, { date: '2026-09-05' }),
      tx('expense', 800_000, { date: '2026-09-18' }), // después del 17: fuera del tramo anterior
      tx('expense', 400_000, { date: '2026-09-10' }),
      tx('transfer', 300_000, { date: '2026-10-07', to_account_id: 'ahorros' }),
      tx('income', 900_000, { date: '2026-10-08', scope: 'business', category_id: 'cat-b-venta' }),
      tx('expense', 700_000, { date: '2026-09-08', scope: 'business', category_id: 'cat-b-inversion' }),
    ];
    const r = periodComparison(list, { from: '2026-10-01', to: '2026-10-17' }, { from: '2026-09-01', to: '2026-09-17' });
    expect(r.current).toEqual({ income: 2_000_000, expense: 500_000, net: 1_500_000, savingsPct: 75 });
    expect(r.previous).toEqual({ income: 1_000_000, expense: 400_000, net: 600_000, savingsPct: 60 });
    expect(r.change).toEqual({ income: 100, expense: 25, net: 150 });
  });

  it('periodo anterior vacío → cambios No disponible', () => {
    const r = periodComparison([tx('income', 100, { date: '2026-10-05' })], OCT, { from: '2026-09-01', to: '2026-09-30' });
    expect(r.previous).toEqual({ income: 0, expense: 0, net: 0, savingsPct: null });
    expect(r.change).toEqual({ income: null, expense: null, net: null });
  });
});
