import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import type { Ledger } from '@/db/ledger';
import { readLedger } from '@/db/ledger-cache';

// Cambios hechos sin salir de la pantalla (p. ej. Deshacer en el aviso): la pantalla con foco vuelve a leer.
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export function notifyLedgerChanged() {
  listeners.forEach((l) => l());
}

/** Lee cuentas, categorías y movimientos al ganar el foco (p. ej. al volver de un formulario) y cuando cambian los datos. */
export function useLedger() {
  const db = useSQLiteContext();
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Devuelve cómo cancelar: una lectura vieja que termina tarde no pisa a la nueva.
  const load = useCallback(() => {
    let active = true;
    readLedger(db)
      .then((l) => {
        if (active) {
          setLedger(l); // el mismo objeto si nada cambió: React no vuelve a dibujar
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      active = false;
    };
  }, [db]);

  useFocusEffect(load);
  useEffect(() => {
    let cancel: (() => void) | undefined;
    const unsubscribe = subscribe(() => {
      cancel?.();
      cancel = load();
    });
    return () => {
      unsubscribe();
      cancel?.();
    };
  }, [load]);

  return { ledger, error };
}
