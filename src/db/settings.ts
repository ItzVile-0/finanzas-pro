// Ajustes clave/valor (migración 2). La validación vive en src/domain/settings.ts; aquí solo SQL.
import type { SQLiteDatabase } from 'expo-sqlite';

import { todayLocal } from '@/domain/dates';
import { encodeSettings, parseSettings, type Settings } from '@/domain/settings';

export async function loadSettings(db: SQLiteDatabase): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  return parseSettings(rows, todayLocal());
}

/** Guarda solo las claves del cambio, todas o ninguna. */
export async function saveSettings(db: SQLiteDatabase, patch: Partial<Settings>): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const [key, value] of encodeSettings(patch)) {
      await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
    }
  });
}
