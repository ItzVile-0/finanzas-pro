/**
 * @jest-environment node
 */
import { isColorKey, isIconKey, parseCategoryStyle } from '@/domain/category-style';
import { DEFAULT_CHANNELS, STORE_CATEGORIES } from '@/domain/store';
import { accountBalances, type Account, type Transaction } from '@/domain/ledger';

import { BASE_CATEGORY_STYLE, MIGRATIONS, PERSONAL_CATEGORIES, V5_STORE_CATEGORIES, V6_CHANNELS } from './migrations';

// SQLite real (Node 24) para probar la migración 5 con datos v4.
type Db = { exec(sql: string): void; prepare(sql: string): { all(): unknown[]; get(): unknown; run(...params: unknown[]): unknown } };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => Db };

describe('migración 3: ícono y color de las categorías base', () => {
  it('cubre exactamente las 18 categorías base, sin repetir', () => {
    const ids = BASE_CATEGORY_STYLE.map(([id]) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(PERSONAL_CATEGORIES.map(([id]) => id).sort());
  });

  it('solo usa claves del catálogo', () => {
    for (const [, icon, color] of BASE_CATEGORY_STYLE) {
      expect(isIconKey(icon)).toBe(true);
      expect(isColorKey(color)).toBe(true);
    }
  });

  it('la migración 3 agrega las dos columnas con valor por defecto', () => {
    expect(MIGRATIONS[2]).toMatch(/ADD COLUMN icon TEXT NOT NULL DEFAULT 'tag'/);
    expect(MIGRATIONS[2]).toMatch(/ADD COLUMN color TEXT NOT NULL DEFAULT 'slate'/);
    expect(MIGRATIONS[2]).toContain("UPDATE categories SET icon = 'work', color = 'green' WHERE id = 'cat-p-nomina';");
  });
});

describe('parseCategoryStyle', () => {
  it('claves válidas se conservan; desconocidas o vacías usan las de por defecto', () => {
    expect(parseCategoryStyle('pets', 'purple')).toEqual({ icon: 'pets', color: 'purple' });
    expect(parseCategoryStyle('dog', '#ff0000')).toEqual({ icon: 'tag', color: 'slate' });
    expect(parseCategoryStyle(undefined, null)).toEqual({ icon: 'tag', color: 'slate' });
  });
});

describe('migración 4: presupuestos y pagos recurrentes', () => {
  it('crea las dos tablas y enlaza los gastos con su plantilla', () => {
    expect(MIGRATIONS[3]).toMatch(/CREATE TABLE budgets/);
    expect(MIGRATIONS[3]).toMatch(/category_id TEXT NOT NULL UNIQUE/);
    expect(MIGRATIONS[3]).toMatch(/alert_pct INTEGER NOT NULL DEFAULT 80/);
    expect(MIGRATIONS[3]).toMatch(/CREATE TABLE recurring_payments/);
    expect(MIGRATIONS[3]).toMatch(/frequency IN \('weekly','biweekly','monthly','yearly'\)/);
    expect(MIGRATIONS[3]).toMatch(/ALTER TABLE transactions ADD COLUMN recurring_id TEXT REFERENCES recurring_payments\(id\)/);
    expect(MIGRATIONS[3]).toMatch(/ALTER TABLE transactions ADD COLUMN recurring_due TEXT/);
  });
});

describe('migración 5: EROSELLE sencillo', () => {
  /** Base v4 con datos como los del APK 1.0.0 (3): cuenta de EROSELLE, aporte y retiro. */
  function v4(): Db {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    MIGRATIONS.slice(0, 4).forEach((m) => db.exec(m));
    db.exec(`
      INSERT INTO accounts (id, scope, name, type, opening_balance, created_at) VALUES
        ('banco','personal','[PRUEBA] Banco','bank',1000000,'x'),
        ('caja','business','[PRUEBA] Caja EROSELLE','cash',500000,'x');
      INSERT INTO transactions (id, scope, kind, amount, date, account_id, to_account_id, category_id, note, created_at) VALUES
        ('aporte','personal','capital_contribution',200000,'2026-10-02','banco','caja',NULL,'[PRUEBA] Aporte','x'),
        ('retiro','business','owner_withdrawal',300000,'2026-10-05','caja','banco',NULL,'[PRUEBA] Retiro','x'),
        ('gasto','personal','expense',50000,'2026-10-06','banco',NULL,'cat-p-transporte','[PRUEBA] Bus','x');`);
    return db;
  }
  const balances = (db: Db) =>
    accountBalances(
      (db.prepare('SELECT * FROM accounts').all() as Account[]).map((a) => ({ ...a, allow_negative: false, archived: false })),
      db.prepare('SELECT * FROM transactions').all() as Transaction[],
    );

  it('su texto no cambió al sacar la tienda del código (migración publicada)', () => {
    expect(MIGRATIONS[4]).toContain(`('cat-b-inversion', 'business', 'expense', '${V5_STORE_CATEGORIES[0][2]}', 'shopping', 'pink'),\n  ('cat-b-venta', 'business', 'income', '${V5_STORE_CATEGORIES[1][2]}', 'sell', 'green');`);
  });

  it('10. aporte y retiro pasan a transferencias, la cuenta de EROSELLE a personal, y ningún saldo cambia', () => {
    const db = v4();
    const before = balances(db);
    db.exec(MIGRATIONS[4]);
    expect(balances(db)).toEqual(before);
    expect(db.prepare('SELECT id, scope, kind, note FROM transactions ORDER BY id').all()).toEqual([
      { id: 'aporte', scope: 'personal', kind: 'transfer', note: '[PRUEBA] Aporte' },
      { id: 'gasto', scope: 'personal', kind: 'expense', note: '[PRUEBA] Bus' },
      { id: 'retiro', scope: 'personal', kind: 'transfer', note: '[PRUEBA] Retiro' },
    ]);
    expect(db.prepare("SELECT count(*) n FROM accounts WHERE scope = 'business'").get()).toEqual({ n: 0 });
  });

  it('crea las 2 categorías fijas y el canal solo acepta los 4 canales', () => {
    const db = v4();
    db.exec(MIGRATIONS[4]);
    expect(db.prepare("SELECT id, scope, kind FROM categories WHERE id LIKE 'cat-b-%' ORDER BY rowid").all()).toEqual(
      V5_STORE_CATEGORIES.map(([id, kind]) => ({ id, scope: 'business', kind })),
    );
    for (const [, , , icon, color] of V5_STORE_CATEGORIES) {
      expect(isIconKey(icon)).toBe(true);
      expect(isColorKey(color)).toBe(true);
    }
    const sale = (id: string, channel: string | null) => () =>
      db.prepare(`INSERT INTO transactions (id, scope, kind, amount, date, account_id, category_id, note, created_at, channel)
        VALUES (?, 'business', 'income', 1000, '2026-10-07', 'banco', 'cat-b-venta', '', 'x', ?)`).run(id, channel);
    expect(sale('v1', 'instagram')).not.toThrow();
    expect(sale('v2', 'otro')).toThrow(/CHECK/);
  });
});

describe('migración 6: tienda opcional con canales configurables', () => {
  const v5 = (withData: boolean): Db => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    MIGRATIONS.slice(0, 5).forEach((m) => db.exec(m));
    if (withData) {
      db.exec(`
        INSERT INTO accounts (id, scope, name, type, opening_balance, created_at) VALUES ('banco','personal','[PRUEBA] Banco','bank',100000,'x');
        INSERT INTO transactions (id, scope, kind, amount, date, account_id, category_id, note, created_at, channel) VALUES
          ('inv','business','expense',80000,'2026-10-01','banco','cat-b-inversion','','x',NULL),
          ('v1','business','income',50000,'2026-10-02','banco','cat-b-venta','','x','instagram'),
          ('v2','business','income',30000,'2026-10-03','banco','cat-b-venta','','x','web'),
          ('g','personal','expense',10000,'2026-10-04','banco','cat-p-transporte','','x',NULL);
        INSERT INTO settings (key, value) VALUES ('home_cards', '[{"id":"recent","visible":true},{"id":"eroselle","visible":false}]');`);
    }
    return db;
  };
  const balances = (db: Db) =>
    accountBalances(
      (db.prepare('SELECT * FROM accounts').all() as Account[]).map((a) => ({ ...a, allow_negative: false, archived: false })),
      db.prepare('SELECT * FROM transactions').all() as Transaction[],
    );
  const settings = (db: Db) =>
    Object.fromEntries((db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]).map((r) => [r.key, r.value]));

  it('es la última', () => {
    expect(MIGRATIONS).toHaveLength(6);
  });

  it('base en uso: ningún registro se pierde, cada venta conserva su canal y ningún saldo cambia', () => {
    const db = v5(true);
    const before = balances(db);
    db.exec(MIGRATIONS[5]);
    expect(balances(db)).toEqual(before);
    expect(db.prepare('SELECT id, channel_id FROM transactions ORDER BY id').all()).toEqual([
      { id: 'g', channel_id: null },
      { id: 'inv', channel_id: null },
      { id: 'v1', channel_id: 'instagram' },
      { id: 'v2', channel_id: 'web' },
    ]);
    expect(db.prepare('SELECT id, name, sort_order, archived FROM channels ORDER BY sort_order').all()).toEqual(
      V6_CHANNELS.map(([id, name], i) => ({ id, name, sort_order: i, archived: 0 })),
    );
    // La tienda queda activada con su nombre, sin bienvenida, y la tarjeta del Inicio conserva su lugar y visibilidad.
    const s = settings(db);
    expect(s.store_enabled).toBe('1');
    expect(s.store_name).toBe(/^Venta (.+)$/.exec(V5_STORE_CATEGORIES[1][2])?.[1]);
    expect(s.onboarding_done).toBe('1');
    expect(JSON.parse(s.home_cards)).toEqual([{ id: 'recent', visible: true }, { id: 'store', visible: false }]);
    expect(db.prepare("SELECT id, name FROM categories WHERE id LIKE 'cat-b-%' ORDER BY rowid").all()).toEqual(
      STORE_CATEGORIES.map(([id, , name]) => ({ id, name })),
    );
  });

  it('base nueva: canales sugeridos, tienda sin activar y con bienvenida', () => {
    const db = v5(false);
    db.exec(MIGRATIONS[5]);
    expect(settings(db)).toEqual({});
    expect(db.prepare('SELECT count(*) n FROM channels').get()).toEqual({ n: 4 });
  });

  it('los canales de la migración son los de la bienvenida; un canal nuevo se puede usar y uno inexistente no', () => {
    expect(V6_CHANNELS).toEqual(DEFAULT_CHANNELS);
    const db = v5(true);
    db.exec(MIGRATIONS[5]);
    const sale = (id: string, channel: string) => () =>
      db.prepare(`INSERT INTO transactions (id, scope, kind, amount, date, account_id, category_id, note, created_at, channel_id)
        VALUES (?, 'business', 'income', 1000, '2026-10-07', 'banco', 'cat-b-venta', '', 'x', ?)`).run(id, channel);
    db.exec("INSERT INTO channels (id, name, sort_order) VALUES ('tiktok', 'TikTok', 4)");
    expect(sale('v3', 'tiktok')).not.toThrow();
    expect(sale('v4', 'nada')).toThrow(/FOREIGN KEY/);
  });
});
