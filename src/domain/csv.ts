// CSV de movimientos personales y de la tienda para Excel en español: separador ';', UTF-8 con BOM, fin de línea CRLF.
import { RECORD_LABEL, type RecordType } from './store';
import { KIND_LABEL, type MovementKind } from './ledger';

export type CsvMovement = {
  date: string;
  kind: MovementKind;
  account: string;
  toAccount: string | null;
  category: string | null;
  amount: number;
  note: string;
};

const HEADER = ['Fecha', 'Tipo', 'Cuenta', 'Cuenta destino', 'Categoría', 'Monto', 'Nota'];

/** Texto escrito por el usuario: neutraliza fórmulas de Excel (=, +, -, @, tab, CR) y escapa comillas. */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const byDate = (a: { date: string }, b: { date: string }) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
const csvFile = (header: readonly string[], lines: string[]) => '\ufeff' + [header.join(';'), ...lines].join('\r\n') + '\r\n';

/** Monto entero sin separadores de miles, para que Excel lo tome como número. Orden: por fecha (estable). */
export function movementsCsv(rows: readonly CsvMovement[]): string {
  const lines = [...rows]
    .sort(byDate)
    .map((m) =>
      [m.date, KIND_LABEL[m.kind], csvCell(m.account), csvCell(m.toAccount ?? ''), csvCell(m.category ?? ''), String(m.amount), csvCell(m.note)].join(';'),
    );
  return csvFile(HEADER, lines);
}

/** channel: nombre del canal (solo ventas). */
export type CsvRecord = { date: string; type: RecordType; channel: string | null; account: string; amount: number; note: string };

/** Inversiones y ventas de la tienda, con el mismo formato que movementsCsv. */
export function storeCsv(rows: readonly CsvRecord[]): string {
  const lines = [...rows]
    .sort(byDate)
    .map((r) => [r.date, RECORD_LABEL[r.type], csvCell(r.channel ?? ''), csvCell(r.account), String(r.amount), csvCell(r.note)].join(';'));
  return csvFile(['Fecha', 'Tipo', 'Canal', 'Cuenta', 'Monto', 'Nota'], lines);
}
