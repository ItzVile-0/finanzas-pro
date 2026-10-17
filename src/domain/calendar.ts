// Cuadrícula de un mes para el calendario propio. Semanas desde el domingo o desde el lunes, fechas contables 'YYYY-MM-DD'.
import type { WeekStart } from './settings';

const pad = (n: number) => String(n).padStart(2, '0');

function parseMonth(ym: string): [number, number] {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw new Error(`Mes inválido (se espera YYYY-MM): ${ym}`);
  return [Number(m[1]), Number(m[2])];
}

/** Días del mes (febrero: 29 en bisiesto; 2100 no es bisiesto). */
export function daysInMonth(ym: string): number {
  const [y, m] = parseMonth(ym);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 'YYYY-MM' + n meses (n negativo resta; cruza años). */
export function addMonths(ym: string, n: number): string {
  const [y, m] = parseMonth(ym);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/** Semanas del mes (domingo primero); null = casilla vacía antes del día 1 o después del último. */
/** Días de la semana en el orden de la cuadrícula (0 = domingo … 6 = sábado). */
export const weekdayOrder = (start: WeekStart = 'sunday'): number[] => (start === 'monday' ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6]);

export function monthGrid(ym: string, start: WeekStart = 'sunday'): (string | null)[][] {
  const [y, m] = parseMonth(ym);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // 0 = domingo
  const offset = (first - (start === 'monday' ? 1 : 0) + 7) % 7;
  const cells: (string | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: daysInMonth(ym) }, (_, i) => `${ym}-${pad(i + 1)}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}
