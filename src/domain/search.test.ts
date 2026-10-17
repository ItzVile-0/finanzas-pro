import type { Transaction } from './ledger';
import { filterMovements, fold, typeOf, type MovementFilters } from './search';

const NO_FILTERS: MovementFilters = { text: '', type: null, categoryId: null, accountId: null, range: null };

const accounts = [
  { id: 'banco', name: '[PRUEBA] Bancolombia' },
  { id: 'ahorros', name: '[PRUEBA] Ahorros' },
];
const categories = [
  { id: 'cat-p-nomina', name: 'Nómina' },
  { id: 'cat-p-transporte', name: 'Transporte' },
  { id: 'cat-b-venta', name: 'Venta de la tienda' },
];
const channels = [{ id: 'web', name: 'Página web' }];
const names = { accounts, categories, channels };

const tx = (id: string, o: Partial<Transaction>): Transaction => ({
  id, scope: 'personal', kind: 'expense', amount: 1000, date: '2026-10-10', account_id: 'banco', to_account_id: null,
  category_id: 'cat-p-transporte', note: '', created_at: '', ...o,
});
const txs = [
  tx('nomina', { kind: 'income', category_id: 'cat-p-nomina', date: '2026-10-01', note: '[PRUEBA] Pago quincena' }),
  tx('bus', { note: '[PRUEBA] Bus al trabajo', date: '2026-09-20' }),
  tx('ahorro', { kind: 'transfer', category_id: null, account_id: 'banco', to_account_id: 'ahorros' }),
  tx('venta', { scope: 'business', kind: 'income', category_id: 'cat-b-venta', channel_id: 'web', note: 'Body M' }),
];
const ids = (f: Partial<MovementFilters>) => filterMovements(txs, { ...NO_FILTERS, ...f }, names).map((t) => t.id);

describe('filterMovements', () => {
  it('sin filtros devuelve todo, en el mismo orden', () => {
    expect(ids({})).toEqual(['nomina', 'bus', 'ahorro', 'venta']);
  });

  it('texto en nota, categoría, cuenta (origen o destino) y canal; sin mayúsculas ni tildes; cada palabra', () => {
    expect(ids({ text: 'nomina' })).toEqual(['nomina']); // categoría con tilde
    expect(ids({ text: 'BUS trabajo' })).toEqual(['bus']); // nota, palabras en cualquier orden
    expect(ids({ text: 'ahorros' })).toEqual(['ahorro']); // cuenta destino
    expect(ids({ text: 'pagina' })).toEqual(['venta']); // canal
    expect(ids({ text: 'bancolombia transporte' })).toEqual(['bus']);
    expect(ids({ text: '   ' })).toHaveLength(4);
    expect(ids({ text: 'nada parecido' })).toEqual([]);
  });

  it('tipo (también inversión y venta de la tienda), categoría, cuenta y periodo se combinan', () => {
    expect(ids({ type: 'income' })).toEqual(['nomina']); // la venta de la tienda no es un ingreso personal
    expect(ids({ type: 'sale' })).toEqual(['venta']);
    expect(ids({ categoryId: 'cat-p-transporte' })).toEqual(['bus']);
    expect(ids({ accountId: 'ahorros' })).toEqual(['ahorro']); // destino de la transferencia
    expect(ids({ range: { from: '2026-10-01', to: '2026-10-31' } })).toEqual(['nomina', 'ahorro', 'venta']);
    expect(ids({ range: { from: '2026-10-01', to: '2026-10-31' }, accountId: 'banco', type: 'expense' })).toEqual([]);
  });
});

it('fold y typeOf', () => {
  expect(fold('Página Ñandú ÜBER')).toBe('pagina nandu uber');
  expect(typeOf({ scope: 'business', kind: 'expense' })).toBe('investment');
  expect(typeOf({ scope: 'personal', kind: 'transfer' })).toBe('transfer');
});
