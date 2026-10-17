import {
  accountBalances,
  ARCHIVE_NEEDS_ZERO,
  canArchiveAccount,
  canArchiveCategory,
  canDeleteAccount,
  canDeleteCategory,
  CHANGE_KIND,
  validateAccount,
  validateAccountEdit,
  validateCategoryName,
  validateDelete,
  validateMovement,
  validateRestore,
  type Account,
  type Category,
  type MovementInput,
  type Transaction,
} from './ledger';

const acc = (id: string, scope: Account['scope'], opening: number, allowNegative = false): Account => ({
  id, scope, name: `[PRUEBA] ${id}`, type: 'bank', opening_balance: opening, allow_negative: allowNegative, archived: false,
});
const banco = acc('banco', 'personal', 1_000_000);
const ahorros = acc('ahorros', 'personal', 0);
const tarjeta = acc('tarjeta', 'personal', 0, true);
const accounts = [banco, ahorros, tarjeta];

const categories: Category[] = [
  { id: 'cat-p-nomina', scope: 'personal', kind: 'income', name: 'Nómina', archived: false, icon: 'tag', color: 'slate' },
  { id: 'cat-p-transporte', scope: 'personal', kind: 'expense', name: 'Transporte', archived: false, icon: 'tag', color: 'slate' },
  { id: 'cat-b-inversion', scope: 'business', kind: 'expense', name: 'Inversión de la tienda', archived: false, icon: 'tag', color: 'slate' },
];

let seq = 0;
const tx = (t: Partial<Transaction> & Pick<Transaction, 'kind' | 'amount' | 'account_id'>): Transaction => ({
  id: `t${++seq}`, scope: 'personal', date: '2026-10-01', to_account_id: null, category_id: null, note: '', created_at: '', ...t,
});

const input = (m: Partial<MovementInput>): MovementInput => ({
  kind: 'expense', amount: 10_000, date: '2026-10-14', accountId: 'banco', toAccountId: null, categoryId: 'cat-p-transporte', note: '', ...m,
});
const TODAY = '2026-10-14';
const ctx = { accounts, categories, transactions: [] as Transaction[], today: TODAY };
const errorsOf = (m: Partial<MovementInput>) => {
  const r = validateMovement(input(m), ctx);
  return r.ok ? {} : r.errors;
};

describe('saldos (escenarios 1, 2 y 3)', () => {
  it('1. un ingreso sube el saldo', () => {
    const b = accountBalances(accounts, [tx({ kind: 'income', amount: 300_000, account_id: 'banco', category_id: 'cat-p-nomina' })]);
    expect(b.get('banco')).toBe(1_300_000);
  });

  it('2. un gasto baja el saldo', () => {
    const b = accountBalances(accounts, [tx({ kind: 'expense', amount: 50_000, account_id: 'banco', category_id: 'cat-p-transporte' })]);
    expect(b.get('banco')).toBe(950_000);
  });

  it('3. transferencia propia mueve saldo sin cambiar el total ni crear ingreso/gasto', () => {
    const t = tx({ kind: 'transfer', amount: 400_000, account_id: 'banco', to_account_id: 'ahorros' });
    const b = accountBalances(accounts, [t]);
    expect(b.get('banco')).toBe(600_000);
    expect(b.get('ahorros')).toBe(400_000);
    expect(b.get('banco')! + b.get('ahorros')!).toBe(1_000_000);
    const r = validateMovement(input({ kind: 'transfer', toAccountId: 'ahorros', categoryId: null }), ctx);
    expect(r.ok && r.tx.category_id).toBeNull();
  });
});

describe('validateMovement — importes (escenario 15)', () => {
  it.each([0, -5_000, 10.5, NaN, Infinity])('rechaza %p', (amount) => {
    expect(errorsOf({ amount }).amount).toBeDefined();
  });

  it('acepta un gasto válido y deriva el scope de la cuenta', () => {
    const r = validateMovement(input({ note: '  bus  ' }), ctx);
    expect(r).toEqual({
      ok: true,
      tx: { scope: 'personal', kind: 'expense', amount: 10_000, date: '2026-10-14', account_id: 'banco', to_account_id: null, category_id: 'cat-p-transporte', note: 'bus' },
    });
  });
});

describe('validateMovement — rutas', () => {
  it('transferencia: rechaza misma cuenta, falta de destino y categoría', () => {
    expect(errorsOf({ kind: 'transfer', categoryId: null, toAccountId: 'banco' }).toAccountId).toMatch(/distinta/);
    expect(errorsOf({ kind: 'transfer', categoryId: null, toAccountId: null }).toAccountId).toBeDefined();
    expect(errorsOf({ kind: 'transfer', categoryId: 'cat-p-transporte', toAccountId: 'ahorros' }).categoryId).toBeDefined();
  });

  it('aporte y retiro ya no existen: la migración 5 los convirtió en transferencias', () => {
    const r = validateMovement(input({ kind: 'owner_withdrawal' as never, categoryId: null, toAccountId: 'ahorros' }), ctx);
    expect(r.ok ? {} : r.errors.kind).toBe('Elige el tipo de movimiento.');
  });

  it('categoría: debe existir, coincidir con kind y ser personal', () => {
    expect(errorsOf({ categoryId: null }).categoryId).toBeDefined();
    expect(errorsOf({ categoryId: 'cat-p-nomina' }).categoryId).toMatch(/gastos/);
    expect(errorsOf({ kind: 'income', categoryId: 'cat-p-transporte' }).categoryId).toMatch(/ingresos/);
    expect(errorsOf({ categoryId: 'cat-b-inversion' }).categoryId).toMatch(/pestaña de la tienda/);
    expect(errorsOf({ toAccountId: 'ahorros' }).toAccountId).toBeDefined();
  });

  it('fecha y nota', () => {
    expect(errorsOf({ date: '2026-02-30' }).date).toBeDefined();
    expect(errorsOf({ date: '14/10/2026' }).date).toBeDefined();
    expect(errorsOf({ note: 'x'.repeat(201) }).note).toBeDefined();
  });

  it('rechaza fechas futuras (hoy sí se permite)', () => {
    expect(errorsOf({ date: '2026-10-15' }).date).toBe(
      'No se permiten fechas futuras. Los pagos programados llegarán en su propio módulo.',
    );
    expect(errorsOf({ date: TODAY })).toEqual({});
  });

  it('cuenta inexistente o archivada', () => {
    expect(errorsOf({ accountId: 'nada' }).accountId).toBeDefined();
    const archived = { ...ctx, accounts: [{ ...banco, archived: true }] };
    const r = validateMovement(input({}), archived);
    expect(r.ok).toBe(false);
  });
});

describe('saldo negativo: ninguna cuenta salvo allow_negative', () => {
  it('bloquea gasto y transferencia que dejan el saldo bajo 0, con la fecha, el valor y qué hacer', () => {
    expect(errorsOf({ amount: 1_000_001 }).amount).toBe(
      'Saldo insuficiente en [PRUEBA] banco el 14 oct: quedaría en -$\u00a01. Revisa la fecha o registra antes el ingreso.',
    );
    expect(errorsOf({ kind: 'transfer', categoryId: null, toAccountId: 'ahorros', amount: 2_000_000 }).amount).toMatch(/insuficiente/);
  });

  it('permite dejar el saldo exactamente en 0', () => {
    expect(errorsOf({ amount: 1_000_000 })).toEqual({});
  });

  it('permite negativo si la cuenta lo marca (cualquier tipo)', () => {
    expect(errorsOf({ accountId: 'tarjeta', amount: 50_000 })).toEqual({});
  });

  it('un ingreso nunca se bloquea por saldo', () => {
    expect(errorsOf({ kind: 'income', categoryId: 'cat-p-nomina', accountId: 'ahorros' })).toEqual({});
  });
});

// Historia de banco (saldo inicial 1.000.000): ingreso el 5 oct, gasto el 10 oct.
const nomina = tx({ kind: 'income', amount: 500_000, date: '2026-10-05', account_id: 'banco', category_id: 'cat-p-nomina' });
const mercado = tx({ kind: 'expense', amount: 1_400_000, date: '2026-10-10', account_id: 'banco', category_id: 'cat-p-transporte' });
const pase = tx({ kind: 'transfer', amount: 300_000, date: '2026-10-03', account_id: 'banco', to_account_id: 'ahorros' });
const desdeAhorros = tx({ kind: 'expense', amount: 250_000, date: '2026-10-08', account_id: 'ahorros', category_id: 'cat-p-transporte' });
const hist = (transactions: Transaction[]) => ({ ...ctx, transactions });
const asInput = (t: Transaction, m: Partial<MovementInput> = {}): MovementInput => ({
  kind: t.kind, amount: t.amount, date: t.date, accountId: t.account_id, toAccountId: t.to_account_id, categoryId: t.category_id, note: t.note, ...m,
});
const editErrors = (txs: Transaction[], t: Transaction, m: Partial<MovementInput>, c = hist(txs)) => {
  const r = validateMovement(asInput(t, m), c, t);
  return r.ok ? {} : r.errors;
};

describe('historia sin negativos: al crear, editar y eliminar', () => {
  it('eliminar un ingreso antiguo cuyo dinero ya se gastó → rechazado con la fecha del primer negativo', () => {
    expect(validateDelete(nomina.id, hist([nomina, mercado]))).toBe(
      'Saldo insuficiente en [PRUEBA] banco el 10 oct: quedaría en -$\u00a0400.000. Revisa la fecha o registra antes el ingreso.',
    );
    expect(validateDelete(mercado.id, hist([nomina, mercado]))).toBeNull();
  });

  it('bajar un ingreso que deja negativo un día posterior → rechazado; bajarlo poco se acepta', () => {
    expect(editErrors([nomina, mercado], nomina, { amount: 300_000 }).amount).toMatch(/el 10 oct: quedaría en -\$\s100\.000/);
    expect(editErrors([nomina, mercado], nomina, { amount: 400_000 })).toEqual({});
  });

  it('mover un ingreso a una fecha posterior al gasto → rechazado', () => {
    expect(editErrors([nomina, mercado], nomina, { date: '2026-10-12' }).amount).toMatch(/el 10 oct/);
  });

  it('gasto con fecha pasada: saldo final positivo pero un día anterior en negativo → rechazado (hueco de la 4a)', () => {
    const r = validateMovement(input({ amount: 1_200_000, date: '2026-10-02' }), hist([nomina]));
    expect(r.ok ? '' : r.errors.amount).toMatch(/el 2 oct: quedaría en -\$\s200\.000/);
  });

  it('transferencia: eliminarla o reducirla valida la cuenta destino', () => {
    const txs = [pase, desdeAhorros];
    expect(validateDelete(pase.id, hist(txs))).toMatch(/\[PRUEBA\] ahorros el 8 oct: quedaría en -\$\s250\.000/);
    expect(editErrors(txs, pase, { amount: 200_000 }).amount).toMatch(/ahorros el 8 oct: quedaría en -\$\s50\.000/);
  });

  it('cambiar la cuenta de un movimiento valida la cuenta vieja y la nueva', () => {
    // El ingreso pasa de banco a ahorros: banco queda en negativo el 10 oct.
    expect(editErrors([nomina, mercado], nomina, { accountId: 'ahorros' }).amount).toMatch(/banco el 10 oct/);
    // La transferencia cambia de destino: ahorros (destino viejo) queda en negativo el 8 oct.
    const otra = acc('otra', 'personal', 0);
    const c = { ...hist([pase, desdeAhorros]), accounts: [...accounts, otra] };
    expect(editErrors([pase, desdeAhorros], pase, { toAccountId: 'otra' }, c).amount).toMatch(/ahorros el 8 oct/);
  });

  it('varios movimientos el mismo día: cuenta el cierre del día, no el orden de registro', () => {
    const gastoTemprano = tx({ kind: 'expense', amount: 1_200_000, date: '2026-10-05', account_id: 'banco', category_id: 'cat-p-transporte' });
    // Cierre del 5 oct: 1.000.000 + 500.000 − 1.200.000 = 300.000 ≥ 0.
    expect(validateDelete(mercado.id, hist([gastoTemprano, nomina, mercado]))).toBeNull();
    expect(validateMovement(input({ amount: 1_200_000, date: '2026-10-05' }), hist([nomina])).ok).toBe(true);
  });

  it('cuenta con allow_negative: se acepta', () => {
    const ingresoTarjeta = tx({ kind: 'income', amount: 100_000, account_id: 'tarjeta', category_id: 'cat-p-nomina' });
    const gastoTarjeta = tx({ kind: 'expense', amount: 100_000, date: '2026-10-02', account_id: 'tarjeta', category_id: 'cat-p-transporte' });
    expect(validateDelete(ingresoTarjeta.id, hist([ingresoTarjeta, gastoTarjeta]))).toBeNull();
  });

  it('datos viejos ya en negativo: se acepta el cambio que no empeora el peor punto; se rechaza el que lo empeora', () => {
    // Banco ya está en −100.000 el 2 oct.
    const viejo = tx({ kind: 'expense', amount: 1_100_000, date: '2026-10-02', account_id: 'banco', category_id: 'cat-p-transporte' });
    expect(editErrors([viejo], viejo, { amount: 1_050_000 })).toEqual({});
    expect(editErrors([viejo], viejo, { note: 'corregida' })).toEqual({});
    expect(editErrors([viejo], viejo, { amount: 1_150_000 }).amount).toMatch(/quedaría en -\$\s150\.000/);
  });

  it('un ingreso nuevo nunca se bloquea', () => {
    const r = validateMovement(input({ kind: 'income', categoryId: 'cat-p-nomina', date: '2026-10-01' }), hist([nomina, mercado]));
    expect(r.ok).toBe(true);
  });
});

describe('edición: reglas propias', () => {
  it('el tipo (kind) no se puede cambiar', () => {
    expect(editErrors([nomina], nomina, { kind: 'expense', categoryId: 'cat-p-transporte' })).toEqual({ kind: CHANGE_KIND });
  });

  it('eliminar un movimiento que ya no existe', () => {
    expect(validateDelete('nada', hist([nomina]))).toBe('El movimiento ya no existe.');
  });

  it('un registro de la tienda no se edita como movimiento personal (tiene su formulario), pero sí se elimina con las mismas reglas', () => {
    const inversion = tx({ kind: 'expense', amount: 10_000, account_id: 'banco', scope: 'business', category_id: 'cat-b-inversion' });
    expect(editErrors([inversion], inversion, {}).kind).toMatch(/no se edita aquí/);
    expect(validateDelete(inversion.id, hist([inversion]))).toBeNull();
  });
});

describe('edición con cuenta o categoría archivada', () => {
  const archivedCtx = {
    ...hist([nomina]),
    accounts: accounts.map((a) => (a.id === 'banco' ? { ...a, archived: true } : a)),
    categories: categories.map((c) => (c.id === 'cat-p-nomina' ? { ...c, archived: true } : c)),
  };

  it('se acepta si el movimiento ya la tenía', () => {
    expect(validateMovement(asInput(nomina, { note: 'corregida' }), archivedCtx, nomina).ok).toBe(true);
  });

  it('no se puede elegir otra archivada ni usarla en un movimiento nuevo', () => {
    const r = validateMovement(asInput(desdeAhorros, { accountId: 'banco' }), { ...archivedCtx, transactions: [desdeAhorros] }, desdeAhorros);
    expect(r.ok ? {} : r.errors.accountId).toBeDefined();
    expect(validateMovement(asInput(nomina), archivedCtx).ok).toBe(false);
  });
});

const accountInput = (a: Account, m: Partial<Parameters<typeof validateAccountEdit>[0]> = {}) => ({
  name: a.name, type: a.type, openingBalance: a.opening_balance, allowNegative: a.allow_negative, ...m,
});

describe('validateAccountEdit', () => {
  it('cambia nombre, tipo y allow_negative', () => {
    expect(validateAccountEdit(accountInput(banco, { name: 'Banco 2', type: 'savings', allowNegative: true }), banco, [])).toEqual({});
    expect(validateAccountEdit(accountInput(banco, { name: ' ' }), banco, []).name).toBeDefined();
  });

  it('bajar el saldo inicial no puede dejar ningún día en negativo', () => {
    // Banco: 1.000.000 + 500.000 (5 oct) − 1.400.000 (10 oct) = 100.000.
    expect(validateAccountEdit(accountInput(banco, { openingBalance: 900_000 }), banco, [nomina, mercado])).toEqual({});
    expect(validateAccountEdit(accountInput(banco, { openingBalance: 800_000 }), banco, [nomina, mercado]).openingBalance).toMatch(
      /banco el 10 oct: quedaría en -\$\s100\.000/,
    );
  });

  it('datos viejos en negativo: se acepta si no empeora el peor punto', () => {
    const viejo = tx({ kind: 'expense', amount: 1_100_000, date: '2026-10-02', account_id: 'banco', category_id: 'cat-p-transporte' });
    expect(validateAccountEdit(accountInput(banco, { openingBalance: 1_050_000 }), banco, [viejo])).toEqual({});
    expect(validateAccountEdit(accountInput(banco, { openingBalance: 900_000 }), banco, [viejo]).openingBalance).toBeDefined();
  });

  it('quitar allow_negative con días en negativo se rechaza; sin ellos se acepta', () => {
    const gasto = tx({ kind: 'expense', amount: 50_000, date: '2026-10-02', account_id: 'tarjeta', category_id: 'cat-p-transporte' });
    expect(validateAccountEdit(accountInput(tarjeta, { allowNegative: false }), tarjeta, [gasto]).allowNegative).toMatch(
      /el 2 oct quedaría en -\$\s50\.000/,
    );
    expect(validateAccountEdit(accountInput(tarjeta, { allowNegative: false }), tarjeta, [])).toEqual({});
    expect(validateAccountEdit(accountInput(tarjeta, { allowNegative: false, openingBalance: 50_000 }), tarjeta, [gasto])).toEqual({});
  });
});

describe('archivar y eliminar cuentas', () => {
  it('solo se archiva con saldo 0', () => {
    expect(canArchiveAccount(0)).toBeNull();
    expect(canArchiveAccount(1)).toBe(ARCHIVE_NEEDS_ZERO);
    expect(canArchiveAccount(-1)).toBe(ARCHIVE_NEEDS_ZERO);
  });

  it('solo se elimina sin movimientos, también como destino', () => {
    expect(canDeleteAccount('ahorros', [pase])).toMatch(/solo se puede archivar/);
    expect(canDeleteAccount('banco', [pase])).toMatch(/solo se puede archivar/);
    expect(canDeleteAccount('ahorros', [nomina])).toBeNull();
  });
});

describe('categorías', () => {
  const mia: Category = { id: '7f1c-uuid', scope: 'personal', kind: 'expense', name: 'Mascotas', archived: true, icon: 'pets', color: 'purple' };
  const cats = [...categories, mia];

  it('nombre: vacío, largo o repetido (sin importar mayúsculas, mismo tipo, incluso archivada) se rechaza', () => {
    expect(validateCategoryName('Gimnasio', 'expense', cats)).toBeNull();
    expect(validateCategoryName('  ', 'expense', cats)).toBe('Escribe un nombre.');
    expect(validateCategoryName('x'.repeat(61), 'expense', cats)).toBeDefined();
    expect(validateCategoryName(' transporte ', 'expense', cats)).toMatch(/Ya existe una categoría de gastos/);
    expect(validateCategoryName('MASCOTAS', 'expense', cats)).toMatch(/Ya existe/);
    expect(validateCategoryName('Transporte', 'income', cats)).toBeNull();
    expect(validateCategoryName('Transporte', 'expense', cats, 'cat-p-transporte')).toBeNull();
  });

  it('Nómina no se renombra ni se archiva', () => {
    expect(validateCategoryName('Salario', 'income', cats, 'cat-p-nomina')).toMatch(/Nómina no se renombra/);
    // Mismo nombre: se acepta (Nómina puede cambiar ícono y color).
    expect(validateCategoryName('Nómina', 'income', cats, 'cat-p-nomina')).toBeNull();
    expect(canArchiveCategory('cat-p-nomina')).toMatch(/Nómina no se archiva/);
    expect(canArchiveCategory('cat-p-transporte')).toBeNull();
  });

  it('las base no se eliminan (ni sin movimientos); las del usuario solo sin movimientos', () => {
    expect(canDeleteCategory('cat-p-regalos', [])).toMatch(/base no se eliminan/);
    expect(canDeleteCategory('cat-p-nomina', [])).toMatch(/base no se eliminan/);
    expect(canDeleteCategory(mia.id, [])).toBeNull();
    const conMovimiento = tx({ kind: 'expense', amount: 1_000, account_id: 'banco', category_id: mia.id });
    expect(canDeleteCategory(mia.id, [conMovimiento])).toMatch(/solo se puede archivar/);
  });
});

describe('validateAccount', () => {
  const ok = { name: '[PRUEBA] Banco', scope: 'personal' as const, type: 'bank' as const, openingBalance: 0, allowNegative: false };
  it('acepta una cuenta válida con saldo inicial 0', () => {
    expect(validateAccount(ok)).toEqual({});
  });
  it('rechaza nombre vacío, saldo negativo o decimal y tipo inválido', () => {
    expect(validateAccount({ ...ok, name: '   ' }).name).toBeDefined();
    expect(validateAccount({ ...ok, openingBalance: -1 }).openingBalance).toBeDefined();
    expect(validateAccount({ ...ok, openingBalance: 1.5 }).openingBalance).toBeDefined();
    expect(validateAccount({ ...ok, type: 'x' as never }).type).toBeDefined();
  });
});

describe('deshacer una eliminación (validateRestore)', () => {
  it('vuelve tal cual si nada cambió', () => {
    expect(validateRestore(mercado, hist([nomina]))).toBeNull();
    expect(validateRestore(desdeAhorros, hist([pase]))).toBeNull();
  });

  it('se rechaza si deja un día en negativo (el dinero ya se usó en otro gasto)', () => {
    // Se eliminó el gasto del 10 oct y luego se registró otro el 12 oct con ese dinero: volver el primero deja −1.400.000.
    const otro = tx({ kind: 'expense', amount: 1_400_000, date: '2026-10-12', account_id: 'banco', category_id: 'cat-p-transporte' });
    expect(validateRestore(mercado, hist([nomina, otro]))).toMatch(/Saldo insuficiente en \[PRUEBA\] banco el 12 oct/);
  });

  it('se rechaza si ya está, o si su cuenta o categoría ya no existen', () => {
    expect(validateRestore(mercado, hist([nomina, mercado]))).toMatch(/ya está/);
    expect(validateRestore({ ...mercado, account_id: 'borrada' }, hist([nomina]))).toMatch(/cuenta ya no existe/);
    expect(validateRestore({ ...pase, to_account_id: 'borrada' }, hist([]))).toMatch(/cuenta ya no existe/);
    expect(validateRestore({ ...mercado, category_id: 'cat-borrada' }, hist([nomina]))).toMatch(/categoría ya no existe/);
  });

  it('un ingreso siempre puede volver', () => {
    expect(validateRestore(nomina, hist([mercado]))).toBeNull();
  });
});
