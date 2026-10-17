// Copia de seguridad (.fpbak): JSON de todas las tablas, cifrado con AES-256-GCM y clave derivada de la contraseña
// con scrypt. La cabecera (formato, versión de la base, fecha, parámetros) va en claro pero autenticada (AAD):
// si se altera un byte, el descifrado falla. Lo que toca SQLite o el disco vive en src/db (etapa 6b).
import { gcm } from '@noble/ciphers/aes.js';
import { bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes } from '@noble/ciphers/utils.js';
import { scryptAsync } from '@noble/hashes/scrypt.js';

import { daysBetween, todayLocal } from './dates';
import { HOME_CARDS } from './home-cards';
import { DEFAULT_CHANNELS, DEFAULT_STORE_NAME, SALE_CATEGORY_ID, STORE_CATEGORIES } from './store';

export const BACKUP_FORMAT = 'finanzas-pro-backup';
export const BACKUP_EXTENSION = '.fpbak';
export const PASSWORD_MIN = 12;

/** Orden de inserción (las tablas referenciadas primero). Se borra en el orden inverso. */
export const BACKUP_TABLES = ['accounts', 'categories', 'recurring_payments', 'budgets', 'channels', 'transactions', 'settings'] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];
export type BackupValue = string | number | null;
export type BackupRow = Record<string, BackupValue>;
export type BackupData = { schemaVersion: number; exportedAt: string; tables: Record<BackupTable, BackupRow[]> };
/** Columnas actuales de cada tabla (en 6b salen de PRAGMA table_info). */
export type Schema = Record<BackupTable, readonly string[]>;
export type KdfParams = { N: number; r: number; p: number };

/** Ajustes propios de este teléfono: no viajan en la copia ni se pisan al restaurar. */
export const LOCAL_SETTING_KEYS = ['last_backup_at', 'onboarding_done', 'notifications'];

// Medido en el teléfono del usuario (Expo Go, 2026-10-16): 2^14 = 7,8 s, 2^15 = 15,6 s → 2^12 ≈ 2 s (algo menos en el APK).
// shortcut: scrypt en JS puro es lento en Hermes y obliga a un N bajo; la contraseña de 12+ compensa. Si se agrega un
// módulo nativo de cripto, subir N: va en cada archivo, así que las copias viejas siguen abriendo.
export const KDF: KdfParams = { N: 2 ** 12, r: 8, p: 1 };
// Límites al leer un archivo ajeno: unos parámetros enormes colgarían la app o agotarían la memoria.
const KDF_MAX = { N: 2 ** 20, r: 16, p: 4 };

export class BackupError extends Error {}

const WRONG = 'Contraseña incorrecta o archivo dañado.';
const NOT_OURS = 'Este archivo no es una copia de Finanzas Pro.';

export function validateNewPassword(password: string, confirm: string): string | null {
  if ([...password].length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
  if (password !== confirm) return 'Las contraseñas no coinciden.';
  return null;
}

type Header = { format: string; v: 1; schema_version: number; exported_at: string; kdf: KdfParams & { salt: string } };

// Orden fijo de las claves: el AAD debe ser idéntico al cifrar y al descifrar.
const aad = (h: Header) =>
  utf8ToBytes(JSON.stringify([h.format, h.v, h.schema_version, h.exported_at, h.kdf.N, h.kdf.r, h.kdf.p, h.kdf.salt]));

// Asíncrono: cede el hilo de JS cada pocos ms para que la pantalla muestre "Cifrando…" sin congelarse.
const deriveKey = (password: string, salt: Uint8Array, k: KdfParams) =>
  scryptAsync(password.normalize('NFC'), salt, { N: k.N, r: k.r, p: k.p, dkLen: 32 });

/** salt (16 bytes) y nonce (12 bytes) al azar los pone quien llama (expo-crypto): así la función es pura y probable. */
export async function encryptBackup(
  data: BackupData,
  password: string,
  salt: Uint8Array,
  nonce: Uint8Array,
  kdf: KdfParams = KDF,
): Promise<string> {
  if (salt.length !== 16 || nonce.length !== 12) throw new Error('salt de 16 bytes y nonce de 12 bytes');
  const header: Header = {
    format: BACKUP_FORMAT,
    v: 1,
    schema_version: data.schemaVersion,
    exported_at: data.exportedAt,
    kdf: { ...kdf, salt: bytesToHex(salt) },
  };
  const key = await deriveKey(password, salt, kdf);
  const ciphertext = gcm(key, nonce, aad(header)).encrypt(utf8ToBytes(JSON.stringify(data.tables)));
  return JSON.stringify({ ...header, nonce: bytesToHex(nonce), data: bytesToHex(ciphertext) });
}

const isInt = (x: unknown, min: number, max: number): x is number => Number.isInteger(x) && (x as number) >= min && (x as number) <= max;
const isHex = (x: unknown, bytes?: number): x is string =>
  typeof x === 'string' && /^([0-9a-f]{2})*$/.test(x) && (bytes === undefined || x.length === bytes * 2);

/** Lee la cabecera sin contraseña (para decir qué es el archivo antes de pedirla). */
export function readBackupHeader(fileText: string): { schemaVersion: number; exportedAt: string } {
  const h = parseEnvelope(fileText);
  return { schemaVersion: h.schema_version, exportedAt: h.exported_at };
}

function parseEnvelope(fileText: string): Header & { nonce: string; data: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(fileText);
  } catch {
    throw new BackupError(NOT_OURS);
  }
  const f = raw as Record<string, unknown> | null;
  if (typeof f !== 'object' || f === null || f.format !== BACKUP_FORMAT) throw new BackupError(NOT_OURS);
  if (f.v !== 1) throw new BackupError('La copia usa un formato más nuevo. Actualiza la app primero.');
  const k = f.kdf as Record<string, unknown> | null;
  const ok =
    isInt(f.schema_version, 1, Number.MAX_SAFE_INTEGER) &&
    typeof f.exported_at === 'string' &&
    typeof k === 'object' &&
    k !== null &&
    isInt(k.N, 2, KDF_MAX.N) &&
    ((k.N as number) & ((k.N as number) - 1)) === 0 &&
    isInt(k.r, 1, KDF_MAX.r) &&
    isInt(k.p, 1, KDF_MAX.p) &&
    isHex(k.salt, 16) &&
    isHex(f.nonce, 12) &&
    isHex(f.data);
  if (!ok) throw new BackupError(WRONG);
  return f as Header & { nonce: string; data: string };
}

/** Descifra y devuelve los datos sin revisar contra la base (eso es checkBackup). */
export async function decryptBackup(fileText: string, password: string): Promise<BackupData> {
  const f = parseEnvelope(fileText);
  let plain: string;
  try {
    const key = await deriveKey(password, hexToBytes(f.kdf.salt), f.kdf);
    plain = bytesToUtf8(gcm(key, hexToBytes(f.nonce), aad(f)).decrypt(hexToBytes(f.data)));
  } catch {
    throw new BackupError(WRONG);
  }
  let tables: unknown;
  try {
    tables = JSON.parse(plain);
  } catch {
    throw new BackupError(WRONG);
  }
  return { schemaVersion: f.schema_version, exportedAt: f.exported_at, tables: tables as BackupData['tables'] };
}

const isValue = (v: unknown): v is BackupValue =>
  v === null || typeof v === 'string' || (typeof v === 'number' && Number.isSafeInteger(v));

/**
 * Revisa la copia contra la base actual antes de tocar nada. Acepta copias de versiones anteriores (las migraciones
 * solo agregan columnas con valor por defecto y tablas: lo que falta queda por defecto o vacío). Rechaza versiones
 * más nuevas, tablas o columnas desconocidas y valores que no sean texto, entero o null. Lo demás (obligatorios,
 * CHECK, llaves foráneas) lo hace cumplir SQLite dentro de la transacción de restauración.
 */
export function checkBackup(data: BackupData, schema: Schema, currentVersion: number): BackupData {
  if (data.schemaVersion > currentVersion)
    throw new BackupError(`La copia es de una versión más nueva de la app (base v${data.schemaVersion}). Actualiza la app primero.`);
  const t = data.tables as unknown;
  if (typeof t !== 'object' || t === null || Array.isArray(t)) throw new BackupError(WRONG);
  for (const name of Object.keys(t)) {
    if (!(BACKUP_TABLES as readonly string[]).includes(name)) throw new BackupError(`La copia tiene una tabla desconocida: ${name}.`);
  }
  const tables = {} as Record<BackupTable, BackupRow[]>;
  for (const name of BACKUP_TABLES) {
    const rows = (t as Record<string, unknown>)[name] ?? [];
    if (!Array.isArray(rows)) throw new BackupError(`Tabla ${name} dañada en la copia.`);
    for (const row of rows) {
      if (typeof row !== 'object' || row === null || Array.isArray(row)) throw new BackupError(`Tabla ${name} dañada en la copia.`);
      for (const [col, v] of Object.entries(row)) {
        if (!schema[name].includes(col)) throw new BackupError(`La copia tiene una columna desconocida: ${name}.${col}.`);
        if (!isValue(v)) throw new BackupError(`Valor inválido en ${name}.${col}.`);
      }
    }
    tables[name] = name === 'settings' ? rows.filter((r) => !LOCAL_SETTING_KEYS.includes(r.key)) : rows;
  }
  return upgradeBackup({ ...data, tables });
}

/**
 * Lo que hacen las migraciones con datos (no solo esquema), aplicado a una copia de una versión anterior, para que
 * quede igual que si esos datos se hubieran migrado.
 * - v < 5: aporte/retiro → transferencia, cuentas de la tienda → personales y las categorías fijas de la tienda.
 * - v < 6: los 4 canales como filas, channel_id = channel, categorías fijas con su nombre nuevo, la tarjeta de la
 *   tienda en home_cards con su id nuevo (el único id que ya no existe; conserva orden y visibilidad) y, si la copia tiene
 *   registros de la tienda, la tienda activada con el nombre que tenía la categoría de venta ("Venta <nombre>").
 */
export function upgradeBackup(data: BackupData): BackupData {
  if (data.schemaVersion >= 6) return data;
  let t = data.tables;
  const oldSale = t.categories.find((c) => c.id === SALE_CATEGORY_ID)?.name;
  if (data.schemaVersion < 5) {
    const old = (kind: BackupValue) => kind === 'capital_contribution' || kind === 'owner_withdrawal';
    const missing = STORE_CATEGORIES.filter(([id]) => !t.categories.some((c) => c.id === id));
    t = {
      ...t,
      accounts: t.accounts.map((a) => (a.scope === 'business' ? { ...a, scope: 'personal' } : a)),
      transactions: t.transactions.map((x) => (old(x.kind) ? { ...x, kind: 'transfer', scope: 'personal' } : x)),
      categories: [
        ...t.categories,
        ...missing.map(([id, kind, name, icon, color]) => ({ id, scope: 'business', kind, name, icon, color, archived: 0 })),
      ],
    };
  }
  const storeName = typeof oldSale === 'string' ? (/^Venta (.+)$/.exec(oldSale)?.[1] ?? DEFAULT_STORE_NAME) : DEFAULT_STORE_NAME;
  const hasRecords = t.transactions.some((x) => x.scope === 'business');
  const hasSetting = (key: string) => t.settings.some((s) => s.key === key);
  const newName = new Map(STORE_CATEGORIES.map(([id, , name]) => [id, name]));
  return {
    ...data,
    tables: {
      ...t,
      channels: t.channels.length > 0 ? t.channels : DEFAULT_CHANNELS.map(([id, name], i) => ({ id, name, sort_order: i, archived: 0 })),
      transactions: t.transactions.map((x) => (x.channel != null && x.channel_id == null ? { ...x, channel_id: x.channel } : x)),
      categories: t.categories.map((c) => (newName.has(String(c.id)) ? { ...c, name: newName.get(String(c.id))! } : c)),
      settings: [
        ...t.settings.map((s) => (s.key === 'home_cards' ? { ...s, value: renameStoreCard(String(s.value)) } : s)),
        ...(hasRecords && !hasSetting('store_enabled') ? [{ key: 'store_enabled', value: '1' }] : []),
        ...(hasRecords && !hasSetting('store_name') ? [{ key: 'store_name', value: storeName }] : []),
      ],
    },
  };
}

/** home_cards de antes de la migración 6: el id que ya no existe era el de la tienda (como hace la migración 6). */
function renameStoreCard(value: string): string {
  try {
    const cards: unknown = JSON.parse(value);
    if (!Array.isArray(cards)) return value;
    return JSON.stringify(
      cards.map((c) => (c && typeof c === 'object' && !(HOME_CARDS as readonly unknown[]).includes((c as { id?: unknown }).id) ? { ...c, id: 'store' } : c)),
    );
  } catch {
    return value; // JSON roto: al leerlo se usa el orden por defecto
  }
}

export type BackupSummary = { exportedAt: string; accounts: number; movements: number; firstDate: string | null; lastDate: string | null };

/** Lo que se muestra antes de confirmar la restauración. */
export function backupSummary(data: BackupData): BackupSummary {
  const dates = data.tables.transactions.map((r) => String(r.date)).sort();
  return {
    exportedAt: data.exportedAt,
    accounts: data.tables.accounts.length,
    movements: dates.length,
    firstDate: dates[0] ?? null,
    lastDate: dates.at(-1) ?? null,
  };
}

export type Statement = { sql: string; params: BackupValue[] };

/**
 * Sentencias para reemplazar todos los datos por los de la copia (ya revisada). Van dentro de UNA transacción:
 * defer_foreign_keys revisa las llaves al confirmar (filas que se apuntan entre sí en cualquier orden).
 */
export function restoreStatements(data: BackupData): Statement[] {
  // Las tarjetas del Inicio de este teléfono se conservan si la copia no trae las suyas (copias anteriores a la 4g).
  const keep = [...LOCAL_SETTING_KEYS, ...(data.tables.settings.some((s) => s.key === 'home_cards') ? [] : ['home_cards'])];
  const out: Statement[] = [{ sql: 'PRAGMA defer_foreign_keys = ON', params: [] }];
  for (const name of [...BACKUP_TABLES].reverse()) {
    out.push(
      name === 'settings'
        ? { sql: `DELETE FROM settings WHERE key NOT IN (${keep.map(() => '?').join(', ')})`, params: keep }
        : { sql: `DELETE FROM ${name}`, params: [] },
    );
  }
  for (const name of BACKUP_TABLES) {
    for (const row of data.tables[name]) {
      const cols = Object.keys(row);
      out.push({ sql: `INSERT INTO ${name} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, params: cols.map((c) => row[c]) });
    }
  }
  return out;
}

/** Fecha local (YYYY-MM-DD) de un instante ISO (exported_at, last_backup_at); null si no es una fecha. */
export function localDateOf(instant: string): string | null {
  const d = new Date(instant);
  return Number.isNaN(d.getTime()) ? null : todayLocal(d);
}

export const BACKUP_REMINDER_DAYS = 7;

/**
 * Recordatorio del Inicio: solo si ya hay movimientos y nunca se exportó una copia o pasaron más de 7 días
 * (por fecha local). days = días desde la última copia (null = nunca).
 */
export function backupReminder(lastBackupAt: string | null, today: string, hasMovements: boolean): { show: boolean; days: number | null } {
  const last = lastBackupAt ? localDateOf(lastBackupAt) : null;
  const days = last ? daysBetween(last, today) : null;
  return { show: hasMovements && (days === null || days > BACKUP_REMINDER_DAYS), days };
}
