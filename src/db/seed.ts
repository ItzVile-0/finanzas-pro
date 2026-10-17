// Datos [PRUEBA] solo para desarrollo (botón en Ajustes bajo __DEV__). Usa el mismo guardado que la app.
import type { SQLiteDatabase } from 'expo-sqlite';

import { addDays, todayLocal } from '@/domain/dates';
import type { RecordInput } from '@/domain/store';
import type { AccountInput, MovementInput } from '@/domain/ledger';
import type { RecurringInput } from '@/domain/recurring';

import { createAccount, saveBudget, saveMovement, saveRecord, saveRecurring } from './ledger';

const ACCOUNTS: [id: string, AccountInput][] = [
  ['prueba-p-banco', { name: '[PRUEBA] Banco', type: 'bank', openingBalance: 2_000_000, allowNegative: false }],
  ['prueba-p-efectivo', { name: '[PRUEBA] Efectivo', type: 'cash', openingBalance: 300_000, allowNegative: false }],
  ['prueba-p-ahorros', { name: '[PRUEBA] Ahorros', type: 'savings', openingBalance: 4_500_000, allowNegative: false }],
];

type SeedMovement = [id: string, day: number, Omit<MovementInput, 'date'>];
const MOVEMENTS: SeedMovement[] = [
  ['prueba-m1', 1, { kind: 'income', amount: 3_200_000, accountId: 'prueba-p-banco', toAccountId: null, categoryId: 'cat-p-nomina', note: '[PRUEBA] Nómina' }],
  ['prueba-m2', 5, { kind: 'expense', amount: 180_000, accountId: 'prueba-p-banco', toAccountId: null, categoryId: 'cat-p-alimentacion', note: '[PRUEBA] Mercado' }],
  ['prueba-m3', 8, { kind: 'transfer', amount: 500_000, accountId: 'prueba-p-banco', toAccountId: 'prueba-p-ahorros', categoryId: null, note: '[PRUEBA] Banco → Ahorros' }],
  ['prueba-m4', 10, { kind: 'expense', amount: 95_000, accountId: 'prueba-p-efectivo', toAccountId: null, categoryId: 'cat-p-transporte', note: '[PRUEBA] Bus y taxi' }],
];

// Tienda (canales de la migración 6): dos registros hace más de un mes (la ganancia acumulada difiere de la del mes) y varios este mes.
// day > 0: día del mes actual (nunca después de hoy); day < 0: días antes de hoy.
type SeedRecord = [id: string, day: number, Omit<RecordInput, 'date'>];
const RECORDS: SeedRecord[] = [
  ['prueba-e1', -40, { type: 'investment', amount: 450_000, accountId: 'prueba-p-banco', channel: null, note: '[PRUEBA] Mercancía inicial' }],
  ['prueba-e2', -35, { type: 'sale', amount: 120_000, accountId: 'prueba-p-efectivo', channel: 'whatsapp', note: '[PRUEBA] Body encaje' }],
  ['prueba-e3', 2, { type: 'investment', amount: 80_000, accountId: 'prueba-p-banco', channel: null, note: '[PRUEBA] Empaques y envíos' }],
  ['prueba-e4', 6, { type: 'sale', amount: 189_900, accountId: 'prueba-p-banco', channel: 'instagram', note: '[PRUEBA] Disfraz' }],
  ['prueba-e5', 9, { type: 'sale', amount: 95_000, accountId: 'prueba-p-efectivo', channel: 'whatsapp', note: '[PRUEBA] Aceite de masaje' }],
  ['prueba-e6', 11, { type: 'sale', amount: 240_000, accountId: 'prueba-p-banco', channel: 'marketplace', note: '' }],
];

// Pagos recurrentes: uno vencido, uno dentro de los próximos 7 días y uno más lejano (días relativos a hoy al cargarlos).
type SeedRecurring = [id: string, offset: number, Omit<RecurringInput, 'firstDate'>];
const RECURRING: SeedRecurring[] = [
  ['prueba-r1', -3, { concept: '[PRUEBA] Internet', estimatedAmount: 85_000, frequency: 'monthly', accountId: 'prueba-p-banco', categoryId: 'cat-p-servicios' }],
  ['prueba-r2', 4, { concept: '[PRUEBA] Arriendo', estimatedAmount: 900_000, frequency: 'monthly', accountId: 'prueba-p-banco', categoryId: 'cat-p-vivienda' }],
  ['prueba-r3', 20, { concept: '[PRUEBA] Streaming', estimatedAmount: 32_900, frequency: 'monthly', accountId: 'prueba-p-efectivo', categoryId: 'cat-p-suscripciones' }],
];

// Datos extremos para probar la apariencia (Muy grande + Compacta + fuente ancha): una cuenta con un saldo de diez cifras y
// nombre largo, notas largas, 6 meses de movimientos, un mes de la tienda con pérdida y un presupuesto excedido.
// day < 0: días antes de hoy.
const EXTREME_ACCOUNTS: [id: string, AccountInput][] = [
  ['prueba-x-grande', { name: '[PRUEBA] Ahorros programados de largo plazo', type: 'savings', openingBalance: 1_234_567_890, allowNegative: false }],
];
const EXTREME_MOVEMENTS: [id: string, day: number, Omit<MovementInput, 'date'>][] = [
  ...[-1, -31, -62, -92, -123, -153].map((day, i): [string, number, Omit<MovementInput, 'date'>] => [
    `prueba-x-nomina-${i}`, day,
    { kind: 'income', amount: 4_850_000, accountId: 'prueba-p-banco', toAccountId: null, categoryId: 'cat-p-nomina', note: '[PRUEBA] Nómina' },
  ]),
  ...[-2, -33, -64, -95, -126].map((day, i): [string, number, Omit<MovementInput, 'date'>] => [
    `prueba-x-mercado-${i}`, day,
    { kind: 'expense', amount: 612_350 + i * 41_000, accountId: 'prueba-p-banco', toAccountId: null, categoryId: 'cat-p-alimentacion', note: '' },
  ]),
  ['prueba-x-matricula', -3, {
    kind: 'expense', amount: 987_654_321, accountId: 'prueba-x-grande', toAccountId: null, categoryId: 'cat-p-educacion',
    note: '[PRUEBA] Matrícula semestral de la universidad con una nota muy larga para ver cómo se corta el texto en la fila',
  }],
  ['prueba-x-entretenimiento', -4, { kind: 'expense', amount: 1_250_000, accountId: 'prueba-p-banco', toAccountId: null, categoryId: 'cat-p-entretenimiento', note: '[PRUEBA] Concierto' }],
];
const EXTREME_RECORDS: [id: string, day: number, Omit<RecordInput, 'date'>][] = [
  ['prueba-x-e1', -70, { type: 'investment', amount: 2_400_000, accountId: 'prueba-p-banco', channel: null, note: '[PRUEBA] Mercancía de temporada (mes con pérdida)' }],
  ['prueba-x-e2', -66, { type: 'sale', amount: 310_000, accountId: 'prueba-p-banco', channel: 'web', note: '' }],
  ['prueba-x-e3', -100, { type: 'sale', amount: 1_150_000, accountId: 'prueba-p-banco', channel: 'instagram', note: '[PRUEBA] Pedido grande' }],
  ['prueba-x-e4', -130, { type: 'investment', amount: 380_000, accountId: 'prueba-p-banco', channel: null, note: '' }],
];

/**
 * Idempotente: IDs fijos; lo que ya existe se omite. Movimientos en el mes actual, nunca después de hoy (los recurrentes
 * sí pueden ser futuros). `extreme`: además, los datos extremos de arriba y un presupuesto de Alimentación excedido.
 */
export async function loadTestData(db: SQLiteDatabase, { extreme = false } = {}): Promise<{ created: number; skipped: number }> {
  const has = async (table: 'accounts' | 'transactions' | 'recurring_payments', id: string) =>
    (await db.getFirstAsync(`SELECT 1 FROM ${table} WHERE id = ?`, id)) !== null;
  const today = todayLocal();
  const dayOf = (d: number) => `${today.slice(0, 8)}${String(Math.min(d, Number(today.slice(8)))).padStart(2, '0')}`;
  let created = 0;
  let skipped = 0;

  const accounts = extreme ? [...ACCOUNTS, ...EXTREME_ACCOUNTS] : ACCOUNTS;
  const movements = extreme ? [...MOVEMENTS, ...EXTREME_MOVEMENTS] : MOVEMENTS;
  const records = extreme ? [...RECORDS, ...EXTREME_RECORDS] : RECORDS;
  // Fecha: día del mes actual (day > 0, nunca después de hoy) o días antes de hoy (day < 0).
  const dateOf = (day: number) => (day > 0 ? dayOf(day) : addDays(today, day));

  for (const [id, input] of accounts) {
    if (await has('accounts', id)) skipped++;
    else {
      const r = await createAccount(db, input, id);
      if (!r.ok) throw new Error(`Cuenta ${id}: ${Object.values(r.errors).join(' ')}`);
      created++;
    }
  }
  for (const [id, day, input] of movements) {
    if (await has('transactions', id)) skipped++;
    else {
      const r = await saveMovement(db, { ...input, date: dateOf(day) }, id);
      if (!r.ok) throw new Error(`Movimiento ${id}: ${Object.values(r.errors).join(' ')}`);
      created++;
    }
  }
  for (const [id, day, input] of records) {
    if (await has('transactions', id)) skipped++;
    else {
      const r = await saveRecord(db, { ...input, date: dateOf(day) }, undefined, id);
      if (!r.ok) throw new Error(`Registro de la tienda ${id}: ${Object.values(r.errors).join(' ')}`);
      created++;
    }
  }
  for (const [id, offset, input] of RECURRING) {
    if (await has('recurring_payments', id)) skipped++;
    else {
      const r = await saveRecurring(db, { ...input, firstDate: addDays(today, offset) }, undefined, id);
      if (!r.ok) throw new Error(`Pago recurrente ${id}: ${Object.values(r.errors).join(' ')}`);
      created++;
    }
  }
  if (extreme) {
    const exists = await db.getFirstAsync("SELECT 1 FROM budgets WHERE category_id = 'cat-p-alimentacion'");
    if (exists) skipped++;
    else {
      const r = await saveBudget(db, { categoryId: 'cat-p-alimentacion', amount: 150_000, alertPct: 80 });
      if (!r.ok) throw new Error(`Presupuesto: ${Object.values(r.errors).join(' ')}`);
      created++;
    }
  }
  return { created, skipped };
}
