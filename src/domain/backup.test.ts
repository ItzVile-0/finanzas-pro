/**
 * @jest-environment node
 */
import { MIGRATIONS, V5_STORE_CATEGORIES } from '@/db/migrations';
import { accountBalances, type Account, type Transaction } from '@/domain/ledger';

import {
  BACKUP_TABLES,
  BackupError,
  backupSummary,
  checkBackup,
  decryptBackup,
  encryptBackup,
  backupReminder,
  localDateOf,
  readBackupHeader,
  restoreStatements,
  validateNewPassword,
  type BackupData,
  type BackupRow,
  type Schema,
} from './backup';

// node:sqlite = SQLite real en Node: la restauración se prueba con las migraciones de verdad, no con un simulacro.
// Tipado a mano lo poco que se usa: @types/node choca con los tipos de React Native (setTimeout, etc.).
type Db = {
  exec(sql: string): void;
  prepare(sql: string): { all(): unknown[]; get(): unknown; run(...params: unknown[]): unknown };
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => Db };

const FAST = { N: 16, r: 1, p: 1 }; // solo para tests (rápido)
const SALT = new Uint8Array(16).fill(7);
const NONCE = new Uint8Array(12).fill(9);
const PASS = 'una contraseña larga';

function newDb(): Db {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  MIGRATIONS.forEach((m, i) => db.exec(`${m}; PRAGMA user_version = ${i + 1};`));
  return db;
}

const schemaOf = (db: Db): Schema =>
  Object.fromEntries(
    BACKUP_TABLES.map((t) => [t, (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name)]),
  ) as unknown as Schema;

const dump = (db: Db, exceptKey?: string): BackupData => ({
  schemaVersion: MIGRATIONS.length,
  exportedAt: '2026-10-16T15:00:00.000Z',
  tables: Object.fromEntries(
    BACKUP_TABLES.map((t) => [
      t,
      (db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all() as BackupRow[]).filter((r) => t !== 'settings' || r.key !== exceptKey),
    ]),
  ) as BackupData['tables'],
});

/** Igual que hará src/db: todo en una transacción, llaves revisadas antes de confirmar; si algo falla, ROLLBACK. */
function restore(db: Db, data: BackupData) {
  db.exec('BEGIN');
  try {
    for (const s of restoreStatements(data)) db.prepare(s.sql).run(...s.params);
    if (db.prepare('PRAGMA foreign_key_check').all().length > 0) throw new Error('llaves foráneas rotas');
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function seed(db: Db) {
  const run = (sql: string) => db.exec(sql);
  run(`INSERT INTO accounts (id, scope, name, type, opening_balance, created_at) VALUES
    ('a1','personal','[PRUEBA] Banco','bank',1000000,'2026-10-01T00:00:00Z'),
    ('a2','personal','[PRUEBA] Efectivo','cash',0,'2026-10-01T00:00:00Z')`);
  run(`INSERT INTO categories (id, scope, kind, name, icon, color) VALUES ('c-user','personal','expense','[PRUEBA] Mascotas','gift','pink')`);
  run(`INSERT INTO recurring_payments (id, concept, estimated_amount, frequency, anchor_date, next_due_date, account_id, category_id, created_at)
    VALUES ('r1','[PRUEBA] Internet',90000,'monthly','2026-10-05','2026-11-05','a1','cat-p-servicios','2026-10-01T00:00:00Z')`);
  run(`INSERT INTO budgets (id, category_id, amount, created_at) VALUES ('b1','cat-p-alimentacion',800000,'2026-10-01T00:00:00Z')`);
  run(`INSERT INTO transactions (id, scope, kind, amount, date, account_id, to_account_id, category_id, note, created_at, recurring_id, recurring_due) VALUES
    ('t1','personal','income',3000000,'2026-10-01','a1',NULL,'cat-p-nomina','',  '2026-10-01T00:00:00Z',NULL,NULL),
    ('t2','personal','expense',90000,'2026-10-05','a1',NULL,'cat-p-servicios','=1+1 "nota"; rara','2026-10-05T00:00:00Z','r1','2026-10-05'),
    ('t3','personal','transfer',200000,'2026-10-06','a1','a2',NULL,'','2026-10-06T00:00:00Z',NULL,NULL)`);
  run(`INSERT INTO settings (key, value) VALUES ('theme','dark'), ('hide_amounts','1'), ('period','last_3_months'), ('last_backup_at','2026-10-16T15:00:00.000Z')`);
}

describe('contraseña', () => {
  it('exige al menos 12 caracteres y que coincidan', () => {
    expect(validateNewPassword('corta123456', 'corta123456')).toBe('La contraseña debe tener al menos 12 caracteres.');
    expect(validateNewPassword('doce letras!', 'doce letras?')).toBe('Las contraseñas no coinciden.');
    expect(validateNewPassword('doce letras!', 'doce letras!')).toBeNull();
    expect(validateNewPassword('ñandú ñandú', 'ñandú ñandú')).not.toBeNull(); // 11 caracteres aunque ocupe más bytes
  });
});

describe('cifrado', () => {
  const db = newDb();
  seed(db);
  const data = dump(db);

  it('ida y vuelta con los parámetros reales (KDF por defecto)', async () => {
    const file = await encryptBackup(data, PASS, SALT, NONCE);
    await expect(decryptBackup(file, PASS)).resolves.toEqual(data);
  });

  it('el archivo no deja ver los datos en claro', async () => {
    const file = await encryptBackup(data, PASS, SALT, NONCE, FAST);
    expect(file).not.toContain('PRUEBA');
    expect(file).not.toContain('3000000');
    expect(readBackupHeader(file)).toEqual({ schemaVersion: MIGRATIONS.length, exportedAt: data.exportedAt });
  });

  it('contraseña incorrecta, byte alterado o cabecera alterada: mismo error y no devuelve nada', async () => {
    const file = await encryptBackup(data, PASS, SALT, NONCE, FAST);
    const err = 'Contraseña incorrecta o archivo dañado.';
    await expect(decryptBackup(file, PASS + 'x')).rejects.toThrow(err);
    const f = JSON.parse(file);
    const flip = (hex: string) => (hex[0] === '0' ? '1' : '0') + hex.slice(1);
    await expect(decryptBackup(JSON.stringify({ ...f, data: flip(f.data) }), PASS)).rejects.toThrow(err);
    await expect(decryptBackup(JSON.stringify({ ...f, exported_at: '2020-01-01T00:00:00.000Z' }), PASS)).rejects.toThrow(err);
    await expect(decryptBackup(JSON.stringify({ ...f, schema_version: 1 }), PASS)).rejects.toThrow(err);
  });

  it('rechaza archivos ajenos y parámetros de scrypt abusivos sin intentar derivar la clave', async () => {
    await expect(decryptBackup('hola', PASS)).rejects.toThrow('no es una copia de Finanzas Pro');
    await expect(decryptBackup('{"format":"otra"}', PASS)).rejects.toThrow(BackupError);
    const f = JSON.parse(await encryptBackup(data, PASS, SALT, NONCE, FAST));
    await expect(decryptBackup(JSON.stringify({ ...f, v: 2 }), PASS)).rejects.toThrow('formato más nuevo');
    await expect(decryptBackup(JSON.stringify({ ...f, kdf: { ...f.kdf, N: 2 ** 24 } }), PASS)).rejects.toThrow(BackupError);
    await expect(decryptBackup(JSON.stringify({ ...f, kdf: { ...f.kdf, N: 1000 } }), PASS)).rejects.toThrow(BackupError);
  });
});

describe('revisión contra la base actual', () => {
  const db = newDb();
  seed(db);
  const schema = schemaOf(db);
  const data = dump(db);

  it('acepta la copia de la misma versión y quita el ajuste local last_backup_at', () => {
    const checked = checkBackup(data, schema, MIGRATIONS.length);
    expect(checked.tables.settings.map((r) => r.key)).toEqual(['theme', 'hide_amounts', 'period']);
    expect(checked.tables.transactions).toHaveLength(3);
  });

  it('rechaza una versión más nueva de la base', () => {
    expect(() => checkBackup({ ...data, schemaVersion: MIGRATIONS.length + 1 }, schema, MIGRATIONS.length)).toThrow('Actualiza la app primero');
  });

  it('rechaza tablas y columnas desconocidas y valores no enteros', () => {
    const t = data.tables;
    expect(() => checkBackup({ ...data, tables: { ...t, hackers: [] } as never }, schema, MIGRATIONS.length)).toThrow('tabla desconocida');
    const evil = { ...t, accounts: [{ ...t.accounts[0], 'name) VALUES (1); DROP TABLE accounts; --': 'x' }] };
    expect(() => checkBackup({ ...data, tables: evil }, schema, MIGRATIONS.length)).toThrow('columna desconocida');
    const float = { ...t, transactions: [{ ...t.transactions[0], amount: 10.5 }] };
    expect(() => checkBackup({ ...data, tables: float }, schema, MIGRATIONS.length)).toThrow('Valor inválido en transactions.amount');
    expect(() => checkBackup({ ...data, tables: { ...t, accounts: {} as never } }, schema, MIGRATIONS.length)).toThrow('dañada');
  });

  it('resumen para la confirmación', () => {
    expect(backupSummary(data)).toEqual({
      exportedAt: data.exportedAt,
      accounts: 2,
      movements: 3,
      firstDate: '2026-10-01',
      lastDate: '2026-10-06',
    });
  });
});

describe('prueba 14: restaurar respaldo recupera los datos', () => {
  it('reemplaza todo por la copia, conserva last_backup_at del teléfono y los ajustes viajan', async () => {
    const db = newDb();
    seed(db);
    const original = dump(db, 'last_backup_at');
    const file = await encryptBackup(dump(db), PASS, SALT, NONCE, FAST);

    // Cambios después de la copia: se borran movimientos y presupuesto, aparece otra cuenta y cambian los ajustes.
    db.exec(`DELETE FROM transactions; DELETE FROM budgets;
      INSERT INTO accounts (id, scope, name, type, created_at) VALUES ('a9','personal','Nueva','cash','2026-10-16T00:00:00Z');
      UPDATE settings SET value = 'light' WHERE key = 'theme';
      UPDATE settings SET value = '2026-10-20T00:00:00.000Z' WHERE key = 'last_backup_at';`);

    restore(db, checkBackup(await decryptBackup(file, PASS), schemaOf(db), MIGRATIONS.length));

    expect(dump(db, 'last_backup_at')).toEqual(original);
    expect(db.prepare(`SELECT value FROM settings WHERE key = 'last_backup_at'`).get()).toEqual({ value: '2026-10-20T00:00:00.000Z' });
  });

  it('copia de una versión anterior (base v3, sin presupuestos ni recurrentes): lo nuevo queda vacío o por defecto', () => {
    const db = newDb();
    seed(db);
    const tx = { id: 'old', scope: 'personal', kind: 'income', amount: 5000, date: '2026-09-01', account_id: 'a1', to_account_id: null, category_id: 'cat-p-nomina', note: '', created_at: '2026-09-01T00:00:00Z' };
    const accounts = dump(db).tables.accounts;
    const categories = dump(db).tables.categories.map(({ id, scope, kind, name, parent_id, archived }) => ({ id, scope, kind, name, parent_id, archived }));
    const v3 = { schemaVersion: 3, exportedAt: '2026-09-02T00:00:00.000Z', tables: { accounts, categories, transactions: [tx], settings: [] } } as unknown as BackupData;

    restore(db, checkBackup(v3, schemaOf(db), MIGRATIONS.length));

    expect(db.prepare('SELECT count(*) n FROM budgets').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT id, recurring_id FROM transactions').all()).toEqual([{ id: 'old', recurring_id: null }]);
    expect(db.prepare(`SELECT icon FROM categories WHERE id = 'cat-p-nomina'`).get()).toEqual({ icon: 'tag' }); // por defecto
  });

  it('si la copia rompe una llave foránea, no cambia nada (todo o nada)', () => {
    const db = newDb();
    seed(db);
    const before = dump(db);
    const data = checkBackup(dump(db), schemaOf(db), MIGRATIONS.length);
    const broken = { ...data, tables: { ...data.tables, accounts: data.tables.accounts.filter((a) => a.id !== 'a2') } };

    expect(() => restore(db, broken)).toThrow();
    expect(dump(db)).toEqual(before);
  });
});

describe('localDateOf', () => {
  it('pasa el instante a la fecha local y no inventa fechas', () => {
    const at = new Date(2026, 9, 16, 23, 30); // 16 oct, 11:30 p. m. hora local
    expect(localDateOf(at.toISOString())).toBe('2026-10-16');
    expect(localDateOf('no es fecha')).toBeNull();
  });
});

describe('recordatorio de copia (Inicio)', () => {
  const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 21, 0).toISOString(); // 9 p. m. local
  it('sin movimientos no molesta; nunca exportada con movimientos sí', () => {
    expect(backupReminder(null, '2026-10-16', false)).toEqual({ show: false, days: null });
    expect(backupReminder(null, '2026-10-16', true)).toEqual({ show: true, days: null });
  });
  it('aparece solo con MÁS de 7 días, contados por fecha local', () => {
    expect(backupReminder(at(2026, 10, 9), '2026-10-16', true)).toEqual({ show: false, days: 7 });
    expect(backupReminder(at(2026, 10, 8), '2026-10-16', true)).toEqual({ show: true, days: 8 });
    expect(backupReminder(at(2026, 10, 16), '2026-10-16', true)).toEqual({ show: false, days: 0 });
  });
});

describe('11. copia v4 (cuenta de la tienda, aporte y retiro) restaurada en la base actual', () => {
  it('queda convertida igual que la migración 5, con los mismos saldos y las categorías de la tienda', () => {
    const db = newDb();
    const t = dump(db).tables;
    const v4 = {
      schemaVersion: 4,
      exportedAt: '2026-10-10T00:00:00.000Z',
      tables: {
        accounts: [
          { id: 'banco', scope: 'personal', name: '[PRUEBA] Banco', type: 'bank', opening_balance: 1000000, allow_negative: 0, archived: 0, created_at: 'x' },
          { id: 'caja', scope: 'business', name: '[PRUEBA] Caja tienda', type: 'cash', opening_balance: 500000, allow_negative: 0, archived: 0, created_at: 'x' },
        ],
        // Una copia v4 no trae las categorías cat-b-… (no existían).
        categories: t.categories.filter((c) => !String(c.id).startsWith('cat-b-')),
        transactions: [
          { id: 'aporte', scope: 'personal', kind: 'capital_contribution', amount: 200000, date: '2026-10-02', account_id: 'banco', to_account_id: 'caja', category_id: null, note: '', created_at: 'x' },
          { id: 'retiro', scope: 'business', kind: 'owner_withdrawal', amount: 300000, date: '2026-10-05', account_id: 'caja', to_account_id: 'banco', category_id: null, note: '', created_at: 'x' },
        ],
        settings: [],
      },
    } as unknown as BackupData;

    restore(db, checkBackup(v4, schemaOf(db), MIGRATIONS.length));

    expect(db.prepare('SELECT id, scope, kind FROM transactions ORDER BY id').all()).toEqual([
      { id: 'aporte', scope: 'personal', kind: 'transfer' },
      { id: 'retiro', scope: 'personal', kind: 'transfer' },
    ]);
    expect(db.prepare('SELECT id, scope FROM accounts ORDER BY id').all()).toEqual([
      { id: 'banco', scope: 'personal' },
      { id: 'caja', scope: 'personal' },
    ]);
    // Mismos saldos que en la copia: banco 1.000.000 − 200.000 + 300.000; caja 500.000 + 200.000 − 300.000.
    const rows = db.prepare('SELECT * FROM transactions').all() as Transaction[];
    const accounts = (db.prepare('SELECT * FROM accounts').all() as Account[]).map((a) => ({ ...a, allow_negative: false, archived: false }));
    expect(Object.fromEntries(accountBalances(accounts, rows))).toEqual({ banco: 1_100_000, caja: 400_000 });
    expect(db.prepare("SELECT count(*) n FROM categories WHERE id LIKE 'cat-b-%'").get()).toEqual({ n: 2 });
  });

  it('copia v5 (ventas con canal fijo): se restaura con sus canales, la tienda activada con su nombre y los mismos saldos', () => {
    // La copia sale de una base v5 real (migraciones 1 a 5), como la que exportaba el APK anterior.
    const old = new DatabaseSync(':memory:');
    old.exec('PRAGMA foreign_keys = ON;');
    MIGRATIONS.slice(0, 5).forEach((m) => old.exec(m));
    old.exec(`
      INSERT INTO accounts (id, scope, name, type, opening_balance, created_at) VALUES ('banco','personal','[PRUEBA] Banco','bank',100000,'x');
      INSERT INTO transactions (id, scope, kind, amount, date, account_id, category_id, note, created_at, channel) VALUES
        ('inv','business','expense',80000,'2026-10-01','banco','cat-b-inversion','','x',NULL),
        ('v1','business','income',50000,'2026-10-02','banco','cat-b-venta','','x','marketplace');`);
    const tables = Object.fromEntries(
      BACKUP_TABLES.filter((t) => t !== 'channels').map((t) => [t, old.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all()]),
    ) as BackupData['tables'];
    const db = newDb();
    restore(db, checkBackup({ schemaVersion: 5, exportedAt: '2026-10-16T00:00:00.000Z', tables }, schemaOf(db), MIGRATIONS.length));

    expect(db.prepare("SELECT id, channel_id FROM transactions WHERE kind = 'income'").all()).toEqual([{ id: 'v1', channel_id: 'marketplace' }]);
    expect(db.prepare('SELECT count(*) n FROM channels').get()).toEqual({ n: 4 });
    const settings = Object.fromEntries((db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]).map((r) => [r.key, r.value]));
    expect(settings.store_enabled).toBe('1');
    expect(settings.store_name).toBe(/^Venta (.+)$/.exec(V5_STORE_CATEGORIES[1][2])?.[1]);
    const rows = db.prepare('SELECT * FROM transactions').all() as Transaction[];
    const accounts = (db.prepare('SELECT * FROM accounts').all() as Account[]).map((a) => ({ ...a, allow_negative: false, archived: false }));
    expect(accountBalances(accounts, rows).get('banco')).toBe(70_000);
  });

  it('tarjetas del Inicio: sin las suyas en la copia se conservan las del teléfono; las de una copia v5 conservan orden y visibilidad', () => {
    const phone = '[{"id":"recent","visible":true},{"id":"accounts","visible":false}]';
    const setCards = (db: Db, v: string) => db.prepare("INSERT INTO settings (key, value) VALUES ('home_cards', ?)").run(v);
    const cards = (db: Db) => JSON.parse((db.prepare("SELECT value FROM settings WHERE key = 'home_cards'").get() as { value: string }).value);

    // Copia sin home_cards (anterior a la 4g): quedan las del teléfono.
    const db = newDb();
    setCards(db, phone);
    const old = { ...dump(newDb()), schemaVersion: 4 };
    old.tables = { ...old.tables, settings: [{ key: 'theme', value: 'dark' }] };
    restore(db, checkBackup(old, schemaOf(db), MIGRATIONS.length));
    expect(cards(db)).toEqual(JSON.parse(phone));

    // Copia v5 con home_cards: manda la de la copia, con la tarjeta de la tienda en su lugar (id viejo → store).
    const db2 = newDb();
    setCards(db2, phone);
    const v5 = { ...dump(newDb()), schemaVersion: 5 };
    const legacyId = 'id-de-antes'; // el id viejo de la tarjeta de la tienda: cualquiera que ya no exista
    v5.tables = { ...v5.tables, channels: [], settings: [{ key: 'home_cards', value: `[{"id":"${legacyId}","visible":false},{"id":"budgets","visible":true}]` }] };
    restore(db2, checkBackup(v5, schemaOf(db2), MIGRATIONS.length));
    expect(cards(db2)).toEqual([{ id: 'store', visible: false }, { id: 'budgets', visible: true }]);
  });

  it('una copia actual (v6) no se toca', () => {
    const db = newDb();
    seed(db);
    const data = dump(db);
    expect(checkBackup(data, schemaOf(db), MIGRATIONS.length).tables.categories).toEqual(data.tables.categories);
  });
});
