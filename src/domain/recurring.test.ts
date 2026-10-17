import { accountBalances, type Account, type Category } from './ledger';
import {
  dueAfterUndo,
  dueText,
  followingDue,
  IN_USE_BY_RECURRING,
  lastPaidDue,
  recurringStatus,
  toBiweeklyDate,
  upcoming,
  usedByActiveRecurring,
  usedByAnyRecurring,
  validateRecurring,
  type Frequency,
  type Recurring,
} from './recurring';

/** n cuotas desde `first` (incluida). */
const sequence = (first: string, frequency: Frequency, n: number, anchor = first) => {
  const out = [first];
  while (out.length < n) out.push(followingDue(anchor, out[out.length - 1], frequency));
  return out;
};

describe('followingDue mensual: fin de mes y bisiestos', () => {
  it('ancla el 31: febrero baja al 28/29 y luego vuelve al 31; abril y junio al 30', () => {
    expect(sequence('2027-12-31', 'monthly', 8)).toEqual([
      '2027-12-31', '2028-01-31', '2028-02-29', '2028-03-31', '2028-04-30', '2028-05-31', '2028-06-30', '2028-07-31',
    ]);
    expect(sequence('2026-01-31', 'monthly', 3)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('ancla el 30 y el 29: solo febrero se ajusta', () => {
    expect(sequence('2026-01-30', 'monthly', 3)).toEqual(['2026-01-30', '2026-02-28', '2026-03-30']);
    expect(sequence('2028-01-29', 'monthly', 3)).toEqual(['2028-01-29', '2028-02-29', '2028-03-29']);
    expect(sequence('2100-01-29', 'monthly', 3)).toEqual(['2100-01-29', '2100-02-28', '2100-03-29']); // 2100 no es bisiesto
  });

  it('día normal y cambio de año', () => {
    expect(sequence('2026-11-05', 'monthly', 4)).toEqual(['2026-11-05', '2026-12-05', '2027-01-05', '2027-02-05']);
  });
});

describe('followingDue anual, semanal y quincenal', () => {
  it('anual del 29 de febrero: 28 en años no bisiestos, 29 en el siguiente bisiesto', () => {
    expect(sequence('2028-02-29', 'yearly', 5)).toEqual(['2028-02-29', '2029-02-28', '2030-02-28', '2031-02-28', '2032-02-29']);
  });

  it('semanal: +7 días cruzando mes y año', () => {
    expect(sequence('2026-12-24', 'weekly', 3)).toEqual(['2026-12-24', '2026-12-31', '2027-01-07']);
  });

  it('quincenal: 15 y último día; febrero normal y bisiesto; cambio de año', () => {
    expect(sequence('2026-01-31', 'biweekly', 5)).toEqual(['2026-01-31', '2026-02-15', '2026-02-28', '2026-03-15', '2026-03-31']);
    expect(sequence('2028-02-15', 'biweekly', 3)).toEqual(['2028-02-15', '2028-02-29', '2028-03-15']);
    expect(sequence('2026-12-15', 'biweekly', 3)).toEqual(['2026-12-15', '2026-12-31', '2027-01-15']);
  });

  it('fecha inválida lanza error', () => {
    expect(() => followingDue('2026-02-30', '2026-03-01', 'monthly')).toThrow();
  });
});

describe('toBiweeklyDate: ajusta a la quincena siguiente', () => {
  it('15 y fin de mes se quedan; lo demás sube a la siguiente quincena', () => {
    expect(toBiweeklyDate('2026-10-15')).toBe('2026-10-15');
    expect(toBiweeklyDate('2026-10-31')).toBe('2026-10-31');
    expect(toBiweeklyDate('2026-10-01')).toBe('2026-10-15');
    expect(toBiweeklyDate('2026-10-16')).toBe('2026-10-31');
    expect(toBiweeklyDate('2026-02-20')).toBe('2026-02-28');
    expect(toBiweeklyDate('2028-02-20')).toBe('2028-02-29');
    expect(toBiweeklyDate('2026-11-30')).toBe('2026-11-30');
  });
});

const rec = (o: Partial<Recurring> = {}): Recurring => ({
  id: 'r1', scope: 'personal', concept: '[PRUEBA] Arriendo', estimated_amount: 1_200_000, frequency: 'monthly',
  anchor_date: '2026-09-05', next_due_date: '2026-10-05', account_id: 'banco', category_id: 'cat-p-vivienda', active: true, ...o,
});

describe('recurringStatus', () => {
  it('vencido si la próxima cuota ya pasó (aunque la anterior se haya pagado)', () => {
    expect(recurringStatus(rec(), '2026-10-06', '2026-09-05')).toBe('overdue');
  });

  it('pagado si se pagó la cuota anterior; pendiente si se omitió o es la primera', () => {
    expect(recurringStatus(rec(), '2026-10-01', '2026-09-05')).toBe('paid');
    expect(recurringStatus(rec(), '2026-10-01', '2026-08-05')).toBe('pending'); // septiembre se omitió
    expect(recurringStatus(rec(), '2026-10-01', null)).toBe('pending');
    expect(recurringStatus(rec(), '2026-10-05', null)).toBe('pending'); // vence hoy: aún no vencido
  });
});

describe('upcoming', () => {
  it('vencidos y próximos 7 días (borde incluido), solo activos, por fecha', () => {
    const items = [
      rec({ id: 'a', next_due_date: '2026-10-21' }), // hoy + 7: entra
      rec({ id: 'b', next_due_date: '2026-10-22' }), // hoy + 8: no
      rec({ id: 'c', next_due_date: '2026-10-01' }), // vencido
      rec({ id: 'd', next_due_date: '2026-10-15', active: false }), // pausado
      rec({ id: 'e', next_due_date: '2026-10-14' }), // hoy
    ];
    expect(upcoming(items, '2026-10-14').map((r) => r.id)).toEqual(['c', 'e', 'a']);
  });
});

const accounts: Account[] = [
  { id: 'banco', scope: 'personal', name: '[PRUEBA] banco', type: 'bank', opening_balance: 1_000_000, allow_negative: false, archived: false },
  { id: 'vieja', scope: 'personal', name: '[PRUEBA] vieja', type: 'bank', opening_balance: 0, allow_negative: false, archived: true },
  { id: 'caja', scope: 'business', name: '[PRUEBA] caja', type: 'cash', opening_balance: 0, allow_negative: false, archived: false },
];
const categories: Category[] = [
  { id: 'cat-p-vivienda', scope: 'personal', kind: 'expense', name: 'Vivienda', archived: false, icon: 'home', color: 'orange' },
  { id: 'cat-p-nomina', scope: 'personal', kind: 'income', name: 'Nómina', archived: false, icon: 'work', color: 'green' },
];
const input = (o = {}) => ({
  concept: 'Arriendo', estimatedAmount: 1_200_000, frequency: 'monthly' as Frequency, firstDate: '2026-11-05',
  accountId: 'banco', categoryId: 'cat-p-vivienda', ...o,
});

describe('validateRecurring', () => {
  it('acepta una plantilla válida con fecha futura', () => {
    expect(validateRecurring(input(), { accounts, categories })).toEqual({});
  });

  it('rechaza concepto vacío, monto 0 o decimal, cuenta archivada o de la tienda, categoría de ingreso', () => {
    const e = (o: object) => validateRecurring(input(o), { accounts, categories });
    expect(e({ concept: ' ' }).concept).toBeDefined();
    expect(e({ estimatedAmount: 0 }).estimatedAmount).toBeDefined();
    expect(e({ estimatedAmount: 10.5 }).estimatedAmount).toBeDefined();
    expect(e({ accountId: 'vieja' }).accountId).toBeDefined();
    expect(e({ accountId: 'caja' }).accountId).toBeDefined();
    expect(e({ categoryId: 'cat-p-nomina' }).categoryId).toBeDefined();
  });

  it('quincenal exige 15 o fin de mes', () => {
    expect(validateRecurring(input({ frequency: 'biweekly', firstDate: '2026-11-10' }), { accounts, categories }).firstDate).toMatch(/15 o el último/);
    expect(validateRecurring(input({ frequency: 'biweekly', firstDate: '2026-11-30' }), { accounts, categories })).toEqual({});
  });
});

describe('archivar con recurrentes', () => {
  it('cuenta o categoría usada por un recurrente activo no se archiva; pausado sí', () => {
    expect(usedByActiveRecurring('banco', [rec()])).toBe(IN_USE_BY_RECURRING);
    expect(usedByActiveRecurring('cat-p-vivienda', [rec()])).toBe(IN_USE_BY_RECURRING);
    expect(usedByActiveRecurring('banco', [rec({ active: false })])).toBeNull();
    expect(usedByActiveRecurring('ahorros', [rec()])).toBeNull();
  });
});

describe('prueba obligatoria 4: un recurrente no confirmado no afecta el saldo', () => {
  it('la plantilla sola no cambia el saldo; solo el gasto creado al confirmar (con el monto real) lo baja', () => {
    const plantilla = rec({ estimated_amount: 200_000 });
    // Los saldos solo se calculan con movimientos: la plantilla vive aparte y no entra.
    expect(accountBalances(accounts, []).get('banco')).toBe(1_000_000);
    const pago = {
      id: 'tx-pago', scope: 'personal' as const, kind: 'expense' as const, amount: 185_000, date: plantilla.next_due_date,
      account_id: plantilla.account_id, to_account_id: null, category_id: plantilla.category_id, note: plantilla.concept, created_at: '',
    };
    expect(accountBalances(accounts, [pago]).get('banco')).toBe(815_000);
  });
});

describe('eliminar con recurrentes', () => {
  it('no se elimina una cuenta o categoría usada por un recurrente, aunque esté pausado', () => {
    expect(usedByAnyRecurring('banco', [rec({ active: false })])).toMatch(/elimínalo o cámbialo/);
    expect(usedByAnyRecurring('otra', [rec()])).toBeNull();
  });

  it('dueAfterUndo: borrar el pago de la última cuota la deja pendiente otra vez; uno más viejo no toca la plantilla', () => {
    // Plantilla mensual del 31: pagada la de febrero (28), la próxima es 31 de marzo.
    const r = rec({ anchor_date: '2026-01-31', next_due_date: '2026-03-31' });
    expect(dueAfterUndo(r, '2026-02-28')).toBe('2026-02-28');
    expect(dueAfterUndo(r, '2026-01-31')).toBeNull();
  });
});

describe('lastPaidDue y dueText', () => {
  const item: Recurring = {
    id: 'r1', scope: 'personal', concept: 'Arriendo', estimated_amount: 900_000, frequency: 'monthly',
    anchor_date: '2026-09-05', next_due_date: '2026-10-05', account_id: 'a', category_id: 'c', active: true,
  };
  const tx = (recurring_id: string | null, recurring_due: string | null) =>
    ({ id: `t-${recurring_due}`, recurring_id, recurring_due }) as Parameters<typeof lastPaidDue>[1][number];

  it('lastPaidDue: la cuota más reciente de esa plantilla; null si nunca se pagó', () => {
    expect(lastPaidDue('r1', [tx('r1', '2026-08-05'), tx('r1', '2026-09-05'), tx('r2', '2026-10-01'), tx(null, null)])).toBe('2026-09-05');
    expect(lastPaidDue('r1', [tx('r2', '2026-10-01')])).toBeNull();
  });

  it('vencido: ayer y hace N días', () => {
    expect(dueText(item, '2026-10-06', null)).toBe('Venció ayer');
    expect(dueText(item, '2026-10-09', null)).toBe('Venció hace 4 días');
  });

  it('pendiente: hoy, mañana, en N días (hasta 7) y luego la fecha', () => {
    expect(dueText(item, '2026-10-05', null)).toBe('Vence hoy');
    expect(dueText(item, '2026-10-04', null)).toBe('Vence mañana');
    expect(dueText(item, '2026-09-28', null)).toBe('Vence en 7 días');
    expect(dueText(item, '2026-09-27', null)).toBe('Vence el 5 oct');
  });

  it('pagado: la cuota anterior se pagó y la próxima aún no llega', () => {
    expect(dueText(item, '2026-09-20', '2026-09-05')).toBe('Pagado · próximo 5 oct');
  });
});
