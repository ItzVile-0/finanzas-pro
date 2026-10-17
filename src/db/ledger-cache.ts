import type { SQLiteDatabase } from 'expo-sqlite';

import { loadLedger, type Ledger } from './ledger';

/**
 * Último libro leído y el total_changes() de SQLite en ese momento. total_changes() sube con cada INSERT, UPDATE o DELETE
 * de esta conexión (también al restaurar una copia o guardar un ajuste): si no cambió, los datos son los mismos y se
 * reutiliza el MISMO objeto, así cambiar de pestaña no vuelve a leer la base ni a recalcular resúmenes y gráficos.
 * No se usa para el estado inicial: un formulario nunca se llena con datos sin confirmar.
 */
let cache: { db: SQLiteDatabase; changes: number; ledger: Ledger } | null = null;

export async function readLedger(db: SQLiteDatabase): Promise<Ledger> {
  const changes = (await db.getFirstAsync<{ c: number }>('SELECT total_changes() AS c'))?.c ?? -1;
  if (cache && cache.db === db && cache.changes === changes) return cache.ledger;
  const ledger = await loadLedger(db);
  cache = { db, changes, ledger };
  return ledger;
}
