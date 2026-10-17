import { channelRemoval, DEFAULT_CHANNELS, storeSummary, monthlyProfit, recordTypeOf, validateChannelName, validateRecord, type Channel, type RecordInput } from './store';
import { accountBalances, type Account, type Transaction } from './ledger';

const TODAY = '2026-10-16';
const OCT = { from: '2026-10-01', to: '2026-10-31' };
const acc = (id: string, opening: number): Account => ({
  id, scope: 'personal', name: `[PRUEBA] ${id}`, type: 'bank', opening_balance: opening, allow_negative: false, archived: false,
});
const banco = acc('banco', 500_000);
const efectivo = acc('efectivo', 0);
const accounts = [banco, efectivo];

let n = 0;
const rec = (type: 'investment' | 'sale', amount: number, o: Partial<Transaction> = {}): Transaction => ({
  id: `r${++n}`,
  scope: 'business',
  kind: type === 'sale' ? 'income' : 'expense',
  amount,
  date: '2026-10-05',
  account_id: 'banco',
  to_account_id: null,
  category_id: type === 'sale' ? 'cat-b-venta' : 'cat-b-inversion',
  note: '[PRUEBA]',
  created_at: '',
  channel_id: type === 'sale' ? 'whatsapp' : null,
  ...o,
});
const input = (o: Partial<RecordInput> = {}): RecordInput => ({
  type: 'investment', amount: 100_000, date: '2026-10-10', accountId: 'banco', channel: null, note: '', ...o,
});
const ch = (id: string, name: string, archived = false, sort_order = 0): Channel => ({ id, name, sort_order, archived });
const channels: Channel[] = [...DEFAULT_CHANNELS.map(([id, name], i) => ch(id, name, false, i)), ch('feria', 'Feria', true, 4)];
const ctx = (transactions: Transaction[] = []) => ({ accounts, transactions, channels, today: TODAY });

describe('validateRecord', () => {
  it('5. una inversión baja el saldo de la cuenta (y se guarda como registro de la tienda)', () => {
    const r = validateRecord(input(), ctx());
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.tx).toMatchObject({ scope: 'business', kind: 'expense', category_id: 'cat-b-inversion', channel_id: null });
    expect(accountBalances(accounts, [{ ...r.tx, id: 'x', created_at: '' }]).get('banco')).toBe(400_000);
  });

  it('6. una venta sube el saldo de la cuenta y lleva su canal', () => {
    const r = validateRecord(input({ type: 'sale', channel: 'instagram', accountId: 'efectivo', note: ' Body M ' }), ctx());
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.tx).toMatchObject({ scope: 'business', kind: 'income', category_id: 'cat-b-venta', channel_id: 'instagram', note: 'Body M' });
    expect(accountBalances(accounts, [{ ...r.tx, id: 'x', created_at: '' }]).get('efectivo')).toBe(100_000);
  });

  it('8. la venta exige un canal activo que exista; la inversión no lleva canal', () => {
    const err = (o: Partial<RecordInput>) => {
      const r = validateRecord(input(o), ctx());
      return r.ok ? {} : r.errors;
    };
    expect(err({ type: 'sale', channel: null }).channel).toBe('Elige el canal de la venta.');
    expect(err({ type: 'sale', channel: 'tiktok' }).channel).toBeDefined(); // no existe
    expect(err({ type: 'sale', channel: 'feria' }).channel).toBeDefined(); // archivado: no se elige en ventas nuevas
    expect(err({ channel: 'web' }).channel).toBe('Una inversión no lleva canal.');
    // Un canal creado por el usuario funciona igual que los 4 de siempre.
    const own = validateRecord(input({ type: 'sale', channel: 'tiktok' }), { ...ctx(), channels: [...channels, ch('tiktok', 'TikTok')] });
    expect(own.ok && own.tx.channel_id).toBe('tiktok');
  });

  it('al editar una venta se conserva su canal archivado; no se puede pasar a otro archivado', () => {
    const venta = rec('sale', 100_000, { channel_id: 'feria' });
    expect(validateRecord(input({ type: 'sale', channel: 'feria', date: '2026-10-05' }), ctx([venta]), venta).ok).toBe(true);
    const other = rec('sale', 100_000);
    expect(validateRecord(input({ type: 'sale', channel: 'feria', date: '2026-10-05' }), ctx([other]), other).ok).toBe(false);
  });

  it('15. importes 0, negativos o con decimales, fecha futura y cuenta inexistente se rechazan', () => {
    for (const amount of [0, -1, 10.5, NaN]) {
      const r = validateRecord(input({ amount }), ctx());
      expect(r.ok ? {} : r.errors.amount).toBeDefined();
    }
    const errs = (o: Partial<RecordInput>) => {
      const r = validateRecord(input(o), ctx());
      return r.ok ? {} : r.errors;
    };
    expect(errs({ date: '2026-10-17' }).date).toMatch('futuras');
    expect(errs({ accountId: 'nada' }).accountId).toBeDefined();
    expect(errs({ note: 'x'.repeat(201) }).note).toBeDefined();
  });

  it('9. una inversión, o editar/eliminar una venta, nunca deja un día en negativo', () => {
    expect(validateRecord(input({ amount: 600_000 }), ctx()).ok).toBe(false);
    // Venta de 300.000 el 5 oct y luego inversión de 700.000 el 8 oct: bajar la venta deja el 8 oct en negativo.
    const venta = rec('sale', 300_000);
    const inversion = rec('investment', 700_000, { date: '2026-10-08' });
    const r = validateRecord(input({ type: 'sale', channel: 'whatsapp', amount: 100_000, date: '2026-10-05' }), ctx([venta, inversion]), venta);
    expect(r.ok ? '' : r.errors.amount).toMatch(/el 8 oct: quedaría en -\$\s100\.000/);
    // Mover la venta a otra cuenta también deja banco en negativo.
    const moved = validateRecord(input({ type: 'sale', channel: 'whatsapp', amount: 300_000, date: '2026-10-05', accountId: 'efectivo' }), ctx([venta, inversion]), venta);
    expect(moved.ok).toBe(false);
  });

  it('al editar el tipo no cambia', () => {
    const venta = rec('sale', 300_000);
    const r = validateRecord(input({ type: 'investment' }), ctx([venta]), venta);
    expect(r.ok ? {} : r.errors.type).toMatch('no se cambia');
  });
});

describe('storeSummary', () => {
  const txs: Transaction[] = [
    rec('investment', 400_000, { date: '2026-09-20' }), // mes anterior
    rec('sale', 150_000, { date: '2026-09-28', channel_id: 'web' }),
    rec('investment', 100_000),
    rec('sale', 200_000, { channel_id: 'whatsapp' }),
    rec('sale', 50_000, { channel_id: 'whatsapp' }),
    rec('sale', 250_000, { channel_id: 'instagram', date: '2026-10-31' }),
    // Movimientos personales: nunca cuentan en la tienda.
    { ...rec('sale', 999_000), scope: 'personal', category_id: 'cat-p-nomina', channel_id: null },
    { ...rec('investment', 888_000), scope: 'personal', category_id: 'cat-p-transporte' },
  ];

  it('7. ganancia del periodo = vendido − invertido solo dentro del periodo', () => {
    const s = storeSummary(txs, OCT);
    expect(s.period).toEqual({ invested: 100_000, sold: 500_000, profit: 400_000 });
    expect(storeSummary(txs, { from: '2026-09-01', to: '2026-09-30' }).period).toEqual({ invested: 400_000, sold: 150_000, profit: -250_000 });
  });

  it('12. ganancia acumulada = todo lo vendido − todo lo invertido, sin importar el periodo', () => {
    const total = { invested: 500_000, sold: 650_000, profit: 150_000 };
    expect(storeSummary(txs, OCT).cumulative).toEqual(total);
    expect(storeSummary(txs, { from: '2026-01-01', to: '2026-01-31' }).cumulative).toEqual(total);
  });

  it('8. ventas por canal (también archivados y creados por el usuario): de mayor a menor, sin canales en 0, suman el total vendido', () => {
    const s = storeSummary(txs, OCT);
    const withArchived = storeSummary([...txs, rec('sale', 70_000, { channel_id: 'feria' })], OCT);
    expect(withArchived.channels.reduce((a, c) => a + c.amount, 0)).toBe(withArchived.period.sold);
    expect(withArchived.channels.at(-1)).toMatchObject({ channel: 'feria', amount: 70_000 });
    // Empate en monto: queda el orden de la primera venta encontrada.
    expect(s.channels.map((c) => [c.channel, c.amount, c.count])).toEqual([
      ['whatsapp', 250_000, 2],
      ['instagram', 250_000, 1],
    ]);
    expect(storeSummary([...txs, rec('sale', 1, { channel_id: 'instagram' })], OCT).channels[0].channel).toBe('instagram');
    expect(s.channels.reduce((a, c) => a + c.amount, 0)).toBe(s.period.sold);
    expect(s.channels.reduce((a, c) => a + c.share, 0)).toBeCloseTo(1);
  });

  it('sin registros: no inventa porcentajes', () => {
    const s = storeSummary([], OCT);
    expect(s).toEqual({ period: { invested: 0, sold: 0, profit: 0 }, cumulative: { invested: 0, sold: 0, profit: 0 }, channels: [], soldShare: null, hasRecords: false });
    expect(storeSummary(txs, OCT).soldShare).toBeCloseTo(500 / 600);
  });

  it('tipo de registro: solo los de scope business', () => {
    expect(recordTypeOf(rec('sale', 1))).toBe('sale');
    expect(recordTypeOf(rec('investment', 1))).toBe('investment');
    expect(recordTypeOf({ scope: 'personal', kind: 'income' })).toBeNull();
  });
});

describe('monthlyProfit (últimos 6 meses)', () => {
  it('vendido, invertido y ganancia por mes; total de los 6 meses; sin personales ni fuera de rango', () => {
    const txs = [
      rec('investment', 300_000, { date: '2026-05-31' }), // antes de los 6 meses
      rec('investment', 200_000, { date: '2026-05-01' }),
      rec('investment', 100_000, { date: '2026-06-01' }),
      rec('sale', 250_000, { date: '2026-06-20', channel_id: 'instagram' }),
      rec('sale', 80_000, { date: '2026-10-16', channel_id: 'web' }),
      { ...rec('sale', 999_000, { date: '2026-10-10' }), scope: 'personal' as const, category_id: 'cat-p-otros', channel_id: null },
    ];
    const r = monthlyProfit(txs, TODAY);
    expect(r.months.map((m) => [m.month, m.label, m.sold, m.invested, m.profit])).toEqual([
      ['2026-05', 'may', 0, 500_000, -500_000],
      ['2026-06', 'jun', 250_000, 100_000, 150_000],
      ['2026-07', 'jul', 0, 0, 0],
      ['2026-08', 'ago', 0, 0, 0],
      ['2026-09', 'sep', 0, 0, 0],
      ['2026-10', 'oct', 80_000, 0, 80_000],
    ]);
    expect(r.total).toEqual({ sold: 330_000, invested: 600_000, profit: -270_000 });
    expect(r.total.profit).toBe(r.months.reduce((s, m) => s + m.profit, 0));
  });
});

describe('canales de venta', () => {
  it('nombre obligatorio, máximo 30 y sin repetir (sin mirar mayúsculas ni tildes)', () => {
    expect(validateChannelName('  Tik   Tok ', channels)).toEqual({ ok: true, name: 'Tik Tok' });
    expect(validateChannelName('   ', channels).ok).toBe(false);
    expect(validateChannelName('x'.repeat(31), channels).ok).toBe(false);
    expect(validateChannelName('pagina WEB', channels)).toEqual({ ok: false, error: 'Ya hay un canal con ese nombre.' });
    expect(validateChannelName('Página web', channels, 'web').ok).toBe(true); // renombrarse a sí mismo
  });

  it('un canal con ventas no se elimina (se archiva); el último activo ni se archiva ni se elimina', () => {
    const sales = [rec('sale', 1, { channel_id: 'whatsapp' })];
    expect(channelRemoval('whatsapp', channels, sales)).toEqual({ canDelete: false, canArchive: true });
    expect(channelRemoval('web', channels, sales)).toEqual({ canDelete: true, canArchive: true });
    const one = [ch('web', 'Web'), ch('feria', 'Feria', true)];
    expect(channelRemoval('web', one, [])).toEqual({ canDelete: false, canArchive: false });
    expect(channelRemoval('feria', one, [])).toEqual({ canDelete: true, canArchive: true });
  });
});
