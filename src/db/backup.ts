// Respaldo: SQL, archivos y menú de compartir. El formato, el cifrado y las reglas viven en src/domain/backup.ts.
import { getRandomBytes } from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  BACKUP_EXTENSION,
  BACKUP_TABLES,
  BackupError,
  LOCAL_SETTING_KEYS,
  backupSummary,
  checkBackup,
  decryptBackup,
  encryptBackup,
  readBackupHeader,
  restoreStatements,
  type BackupData,
  type BackupRow,
  type BackupSummary,
  type Schema,
} from '@/domain/backup';
import { storeCsv, movementsCsv } from '@/domain/csv';
import { todayLocal } from '@/domain/dates';
import { recordTypeOf } from '@/domain/store';
import { isPersonalMovement } from '@/domain/ledger';

import { loadLedger } from './ledger';
import { rescheduleNotifications } from './notifications';
import { saveSettings } from './settings';

// Un archivo así de grande no es una copia de esta app (años de uso ocupan pocos MB): no se carga en memoria.
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const preRestoreFile = () => new File(Paths.document, 'antes-de-restaurar.json');

async function schemaVersion(db: SQLiteDatabase): Promise<number> {
  return (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
}

async function readSchema(db: SQLiteDatabase): Promise<Schema> {
  const entries = await Promise.all(
    BACKUP_TABLES.map(async (t) => [t, (await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`)).map((c) => c.name)] as const),
  );
  return Object.fromEntries(entries) as unknown as Schema;
}

async function dumpAll(db: SQLiteDatabase): Promise<BackupData> {
  const tables = {} as BackupData['tables'];
  for (const t of BACKUP_TABLES) {
    const rows = await db.getAllAsync<BackupRow>(`SELECT * FROM ${t} ORDER BY rowid`);
    tables[t] = t === 'settings' ? rows.filter((r) => !LOCAL_SETTING_KEYS.includes(String(r.key))) : rows;
  }
  return { schemaVersion: await schemaVersion(db), exportedAt: new Date().toISOString(), tables };
}

/** Todo o nada. Las llaves foráneas se revisan antes de confirmar: si algo quedó roto, ROLLBACK. */
async function apply(db: SQLiteDatabase, data: BackupData): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const s of restoreStatements(data)) await db.runAsync(s.sql, s.params);
    if ((await db.getAllAsync('PRAGMA foreign_key_check')).length > 0) {
      throw new BackupError('La copia tiene referencias rotas entre tablas. No se cambió nada.');
    }
  });
}

/**
 * Archivo nuevo en la caché de la app y menú de compartir de Android. Los archivos de la vez anterior se borran ahora,
 * no al cerrar el menú: Drive puede seguir leyendo el archivo después de que el menú se cierra.
 */
async function share(name: string, content: string, mimeType: string, dialogTitle: string): Promise<void> {
  for (const old of Paths.cache.list()) {
    if (old instanceof File && /\.(fpbak|csv)$/.test(old.name)) old.delete();
  }
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(content);
  await shareAsync(file.uri, { mimeType, dialogTitle });
}

/** Cifra todo, abre el menú de compartir y anota la fecha (Android no dice si de verdad se guardó: "exportada"). */
/** Devuelve el instante guardado como última copia. */
export async function exportBackup(db: SQLiteDatabase, password: string): Promise<string> {
  const text = await encryptBackup(await dumpAll(db), password, getRandomBytes(16), getRandomBytes(12));
  await share(`finanzas-pro-${todayLocal()}${BACKUP_EXTENSION}`, text, 'application/octet-stream', 'Guardar copia de Finanzas Pro');
  const at = new Date().toISOString();
  await saveSettings(db, { lastBackupAt: at });
  void rescheduleNotifications(db); // el aviso de copia vuelve a contar 7 días
  return at;
}

export type PickedBackup = { name: string; text: string; exportedAt: string };

/** Elige el archivo y lee su cabecera (sin contraseña). null = el usuario canceló. */
export async function pickBackup(): Promise<PickedBackup | null> {
  const picked = await File.pickFileAsync();
  if (picked.canceled) return null;
  const file = picked.result;
  if ((file.size ?? 0) > MAX_FILE_BYTES) throw new BackupError('Este archivo no es una copia de Finanzas Pro (demasiado grande).');
  const text = await file.text();
  return { name: file.name, text, exportedAt: readBackupHeader(text).exportedAt };
}

/** Descifra y revisa contra la base actual. No cambia nada. */
export async function openBackup(db: SQLiteDatabase, text: string, password: string): Promise<{ data: BackupData; summary: BackupSummary }> {
  const data = checkBackup(await decryptBackup(text, password), await readSchema(db), await schemaVersion(db));
  return { data, summary: backupSummary(data) };
}

/**
 * Guarda primero los datos actuales en la carpeta privada de la app (sin cifrar, como la base misma) para poder
 * volver a ellos; si eso falla, no se restaura. Luego reemplaza todo en una transacción.
 */
export async function restoreBackup(db: SQLiteDatabase, data: BackupData): Promise<void> {
  const copy = preRestoreFile();
  copy.create({ overwrite: true });
  copy.write(JSON.stringify(await dumpAll(db)));
  await apply(db, data);
  void rescheduleNotifications(db); // pagos y movimientos de la copia
}

export function hasPreRestoreCopy(): boolean {
  return preRestoreFile().exists;
}

/** Vuelve a los datos de antes de la última restauración y borra esa copia. */
export async function undoRestore(db: SQLiteDatabase): Promise<void> {
  const copy = preRestoreFile();
  let raw: BackupData;
  try {
    raw = JSON.parse(await copy.text());
  } catch {
    throw new BackupError('La copia de antes de restaurar está dañada. No se cambió nada.');
  }
  await apply(db, checkBackup(raw, await readSchema(db), await schemaVersion(db)));
  copy.delete();
  void rescheduleNotifications(db);
}

/** Movimientos personales (los mismos de la pestaña Movimientos) en CSV para Excel. Sin cifrar. */
export async function exportMovementsCsv(db: SQLiteDatabase): Promise<void> {
  const { accounts, categories, transactions } = await loadLedger(db);
  const account = new Map(accounts.map((a) => [a.id, a.name]));
  const category = new Map(categories.map((c) => [c.id, c.name]));
  const csv = movementsCsv(
    transactions.filter(isPersonalMovement).map((t) => ({
      date: t.date,
      kind: t.kind,
      account: account.get(t.account_id) ?? '',
      toAccount: t.to_account_id ? (account.get(t.to_account_id) ?? '') : null,
      category: t.category_id ? (category.get(t.category_id) ?? '') : null,
      amount: t.amount,
      note: t.note,
    })),
  );
  await share(`finanzas-pro-movimientos-${todayLocal()}.csv`, csv, 'text/csv', 'Exportar movimientos');
}

/** Inversiones y ventas de la tienda en CSV para Excel. Sin cifrar. */
export async function exportStoreCsv(db: SQLiteDatabase, storeName: string): Promise<void> {
  const { accounts, transactions, channels } = await loadLedger(db);
  const account = new Map(accounts.map((a) => [a.id, a.name]));
  const channel = new Map(channels.map((c) => [c.id, c.name]));
  const rows = transactions.flatMap((t) => {
    const type = recordTypeOf(t);
    return type
      ? [{ date: t.date, type, channel: t.channel_id ? (channel.get(t.channel_id) ?? null) : null, account: account.get(t.account_id) ?? '', amount: t.amount, note: t.note }]
      : [];
  });
  await share(`finanzas-pro-tienda-${todayLocal()}.csv`, storeCsv(rows), 'text/csv', `Exportar registros de ${storeName}`);
}
