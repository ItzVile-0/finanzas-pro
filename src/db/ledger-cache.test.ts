import type { SQLiteDatabase } from 'expo-sqlite';

import { readLedger } from './ledger-cache';

/** Base falsa: total_changes() controlado y cuántas lecturas del libro se hicieron. */
function fakeDb() {
  const state = { changes: 0, reads: 0 };
  const db = {
    getFirstAsync: async (sql: string) => (sql.includes('total_changes') ? { c: state.changes } : null),
    getAllAsync: async () => {
      state.reads += 1;
      return [];
    },
  } as unknown as SQLiteDatabase;
  return { db, state };
}

describe('caché del libro (total_changes)', () => {
  it('sin cambios en la base: el mismo objeto y ninguna lectura nueva', async () => {
    const { db, state } = fakeDb();
    const first = await readLedger(db);
    const readsAfterFirst = state.reads;
    expect(readsAfterFirst).toBeGreaterThan(0);
    expect(await readLedger(db)).toBe(first);
    expect(state.reads).toBe(readsAfterFirst);
  });

  it('cualquier escritura (sube total_changes) obliga a leer otra vez', async () => {
    const { db, state } = fakeDb();
    const first = await readLedger(db);
    state.changes += 1;
    const second = await readLedger(db);
    expect(second).not.toBe(first);
    expect(await readLedger(db)).toBe(second);
  });

  it('otra base (otra conexión) nunca usa el caché de la anterior', async () => {
    const a = fakeDb();
    const b = fakeDb();
    const fromA = await readLedger(a.db);
    expect(await readLedger(b.db)).not.toBe(fromA);
  });
});
