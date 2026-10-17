import type { SQLiteDatabase } from 'expo-sqlite';


// Categorías personales iniciales con IDs fijos (respaldos y referencias en código, p. ej. 'cat-p-nomina').
export const PERSONAL_CATEGORIES: [id: string, kind: 'income' | 'expense', name: string][] = [
  ['cat-p-nomina', 'income', 'Nómina'],
  ['cat-p-independientes', 'income', 'Trabajos independientes'],
  ['cat-p-comisiones', 'income', 'Comisiones'],
  ['cat-p-ventas-personales', 'income', 'Ventas personales'],
  ['cat-p-otros-ingresos', 'income', 'Otros ingresos'],
  ['cat-p-vivienda', 'expense', 'Vivienda y arriendo'],
  ['cat-p-servicios', 'expense', 'Servicios públicos'],
  ['cat-p-alimentacion', 'expense', 'Alimentación y mercado'],
  ['cat-p-transporte', 'expense', 'Transporte'],
  ['cat-p-salud', 'expense', 'Salud'],
  ['cat-p-educacion', 'expense', 'Educación'],
  ['cat-p-entretenimiento', 'expense', 'Entretenimiento'],
  ['cat-p-compras', 'expense', 'Compras personales'],
  ['cat-p-regalos', 'expense', 'Regalos'],
  ['cat-p-suscripciones', 'expense', 'Suscripciones'],
  ['cat-p-deudas', 'expense', 'Deudas e intereses'],
  ['cat-p-ahorro', 'expense', 'Ahorro y aportes a inversiones'],
  ['cat-p-otros-gastos', 'expense', 'Otros'],
];

const sqlText = (s: string) => `'${s.replace(/'/g, "''")}'`;

// Migración 5: categorías fijas de la tienda con el nombre que tenían entonces (la migración 6 las renombra). Datos
// propios de la migración: su texto no cambia aunque cambie el código de la tienda.
export const V5_STORE_CATEGORIES: [id: string, kind: 'income' | 'expense', name: string, icon: string, color: string][] = [
  ['cat-b-inversion', 'expense', 'Inversión EROSELLE', 'shopping', 'pink'],
  ['cat-b-venta', 'income', 'Venta EROSELLE', 'sell', 'green'],
];

// Migración 6: los canales que tenía la venta (los 4 fijos de la migración 5), ya como filas editables.
export const V6_CHANNELS: [id: string, name: string][] = [
  ['whatsapp', 'WhatsApp'],
  ['instagram', 'Instagram'],
  ['marketplace', 'Marketplace'],
  ['web', 'Página web'],
];

// Migración 3: ícono y color de las categorías base. Datos propios de la migración (no del catálogo vivo) para que
// su texto no cambie si el catálogo cambia después. Un test comprueba que son claves válidas y cubren las 18.
export const BASE_CATEGORY_STYLE: [id: string, icon: string, color: string][] = [
  ['cat-p-nomina', 'work', 'green'],
  ['cat-p-independientes', 'laptop', 'teal'],
  ['cat-p-comisiones', 'percent', 'blue'],
  ['cat-p-ventas-personales', 'sell', 'indigo'],
  ['cat-p-otros-ingresos', 'payments', 'slate'],
  ['cat-p-vivienda', 'home', 'orange'],
  ['cat-p-servicios', 'bolt', 'amber'],
  ['cat-p-alimentacion', 'cart', 'green'],
  ['cat-p-transporte', 'bus', 'blue'],
  ['cat-p-salud', 'health', 'red'],
  ['cat-p-educacion', 'school', 'indigo'],
  ['cat-p-entretenimiento', 'movie', 'purple'],
  ['cat-p-compras', 'shopping', 'pink'],
  ['cat-p-regalos', 'gift', 'pink'],
  ['cat-p-suscripciones', 'subscriptions', 'purple'],
  ['cat-p-deudas', 'credit', 'red'],
  ['cat-p-ahorro', 'savings', 'teal'],
  ['cat-p-otros-gastos', 'more', 'slate'],
];

/** Scripts en orden. NUNCA editar uno ya publicado: agregar uno nuevo al final. Índice + 1 = user_version. */
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    scope TEXT NOT NULL CHECK (scope IN ('personal','business')),
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    type TEXT NOT NULL CHECK (type IN ('cash','bank','savings','wallet','other')),
    opening_balance INTEGER NOT NULL DEFAULT 0 CHECK (typeof(opening_balance) = 'integer'),
    allow_negative INTEGER NOT NULL DEFAULT 0 CHECK (allow_negative IN (0,1)),
    archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
    created_at TEXT NOT NULL
  );
  CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    scope TEXT NOT NULL CHECK (scope IN ('personal','business')),
    kind TEXT NOT NULL CHECK (kind IN ('income','expense')),
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    parent_id TEXT REFERENCES categories(id),
    archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1))
  );
  CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    scope TEXT NOT NULL CHECK (scope IN ('personal','business')),
    kind TEXT NOT NULL CHECK (kind IN ('income','expense','transfer','capital_contribution','owner_withdrawal')),
    amount INTEGER NOT NULL CHECK (typeof(amount) = 'integer' AND amount > 0),
    date TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    account_id TEXT NOT NULL REFERENCES accounts(id),
    to_account_id TEXT REFERENCES accounts(id),
    category_id TEXT REFERENCES categories(id),
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    CHECK ((kind IN ('transfer','capital_contribution','owner_withdrawal')) = (to_account_id IS NOT NULL)),
    CHECK ((kind IN ('income','expense')) = (category_id IS NOT NULL)),
    CHECK (to_account_id IS NULL OR to_account_id <> account_id)
  );
  CREATE INDEX idx_tx_account_date ON transactions(account_id, date);
  CREATE INDEX idx_tx_to_account ON transactions(to_account_id);
  CREATE INDEX idx_tx_date ON transactions(date);
  INSERT INTO categories (id, scope, kind, name) VALUES
  ${PERSONAL_CATEGORIES.map(([id, kind, name]) => `(${sqlText(id)}, 'personal', ${sqlText(kind)}, ${sqlText(name)})`).join(',\n  ')};
  `,
  // 2: ajustes clave/valor (tema, ocultar cifras, periodo del Panel). Sin filas: si falta una clave, se usa su valor por defecto.
  `
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
  // 3: ícono y color por categoría (claves del catálogo de src/domain/category-style.ts).
  `
  ALTER TABLE categories ADD COLUMN icon TEXT NOT NULL DEFAULT 'tag';
  ALTER TABLE categories ADD COLUMN color TEXT NOT NULL DEFAULT 'slate';
  ${BASE_CATEGORY_STYLE.map(([id, icon, color]) => `UPDATE categories SET icon = ${sqlText(icon)}, color = ${sqlText(color)} WHERE id = ${sqlText(id)};`).join('\n  ')}
  `,
  // 4: presupuestos (un monto por categoría para todos los meses) y pagos recurrentes (plantillas: no afectan el saldo).
  // recurring_id/recurring_due en transactions: qué plantilla y qué cuota pagó cada gasto (para deshacer al eliminarlo).
  `
  CREATE TABLE budgets (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL UNIQUE REFERENCES categories(id),
    amount INTEGER NOT NULL CHECK (typeof(amount) = 'integer' AND amount > 0),
    alert_pct INTEGER NOT NULL DEFAULT 80 CHECK (typeof(alert_pct) = 'integer' AND alert_pct BETWEEN 1 AND 100),
    created_at TEXT NOT NULL
  );
  CREATE TABLE recurring_payments (
    id TEXT PRIMARY KEY,
    scope TEXT NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal','business')),
    concept TEXT NOT NULL CHECK (length(trim(concept)) > 0),
    estimated_amount INTEGER NOT NULL CHECK (typeof(estimated_amount) = 'integer' AND estimated_amount > 0),
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly','biweekly','monthly','yearly')),
    anchor_date TEXT NOT NULL CHECK (anchor_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    next_due_date TEXT NOT NULL CHECK (next_due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    account_id TEXT NOT NULL REFERENCES accounts(id),
    category_id TEXT NOT NULL REFERENCES categories(id),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
    created_at TEXT NOT NULL
  );
  ALTER TABLE transactions ADD COLUMN recurring_id TEXT REFERENCES recurring_payments(id);
  ALTER TABLE transactions ADD COLUMN recurring_due TEXT;
  CREATE INDEX idx_tx_recurring ON transactions(recurring_id);
  `,
  // 5: EROSELLE sencillo. Inversión = expense y venta = income con scope 'business', categorías fijas cat-b-… y canal.
  // Datos v4: ya no hay cuentas de EROSELLE ni aporte/retiro. Aporte y retiro mueven dinero entre cuentas propias igual
  // que una transferencia: se convierten (los saldos no cambian). El restaurador de copias hace lo mismo (upgradeBackup).
  `
  ALTER TABLE transactions ADD COLUMN channel TEXT CHECK (channel IS NULL OR channel IN ('whatsapp','instagram','marketplace','web'));
  INSERT INTO categories (id, scope, kind, name, icon, color) VALUES
  ${V5_STORE_CATEGORIES.map(([id, kind, name, icon, color]) => `(${sqlText(id)}, 'business', ${sqlText(kind)}, ${sqlText(name)}, ${sqlText(icon)}, ${sqlText(color)})`).join(',\n  ')};
  UPDATE transactions SET kind = 'transfer', scope = 'personal' WHERE kind IN ('capital_contribution','owner_withdrawal');
  UPDATE accounts SET scope = 'personal' WHERE scope = 'business';
  `,
  // 6: tienda opcional con nombre y canales configurables. `channel` (CHECK con 4 canales fijos) deja de usarse: cambiarlo
  // obligaría a reconstruir transactions; channel_id apunta a la tabla nueva y recibe el canal de cada venta. Una base
  // con cuentas ya se estaba usando (la del usuario): tienda activada con su nombre y sin bienvenida.
  `
  CREATE TABLE channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    sort_order INTEGER NOT NULL DEFAULT 0 CHECK (typeof(sort_order) = 'integer'),
    archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1))
  );
  INSERT INTO channels (id, name, sort_order) VALUES
  ${V6_CHANNELS.map(([id, name], i) => `(${sqlText(id)}, ${sqlText(name)}, ${i})`).join(',\n  ')};
  ALTER TABLE transactions ADD COLUMN channel_id TEXT REFERENCES channels(id);
  UPDATE transactions SET channel_id = channel WHERE channel IS NOT NULL;
  CREATE INDEX idx_tx_channel ON transactions(channel_id);
  UPDATE categories SET name = 'Inversión de la tienda' WHERE id = 'cat-b-inversion';
  UPDATE categories SET name = 'Venta de la tienda' WHERE id = 'cat-b-venta';
  INSERT OR IGNORE INTO settings (key, value) SELECT 'store_enabled', '1' WHERE EXISTS (SELECT 1 FROM accounts);
  INSERT OR IGNORE INTO settings (key, value) SELECT 'store_name', 'EROSELLE' WHERE EXISTS (SELECT 1 FROM accounts);
  INSERT OR IGNORE INTO settings (key, value) SELECT 'onboarding_done', '1' WHERE EXISTS (SELECT 1 FROM accounts);
  UPDATE settings SET value = replace(value, '"eroselle"', '"store"') WHERE key = 'home_cards';
  `,
];

/** Se ejecuta en SQLiteProvider.onInit antes de mostrar la app. Cada migración es todo o nada. */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current > MIGRATIONS.length) {
    // Base creada por una versión más nueva de la app: no tocar nada para no perder datos.
    throw new Error(`La base de datos es de una versión más nueva (v${current}). Actualiza la app.`);
  }
  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
}
