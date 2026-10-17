// Periodos del Panel por fecha contable local. Meses de calendario, no bloques de 30/90 días.
import { daysInMonth } from './calendar';
import { addDays, daysBetween, formatMonthYear, formatShortDate, formatShortMonth, isValidISODate } from './dates';

export type PeriodKey = 'current_month' | 'previous_month' | 'last_3_months' | 'last_6_months' | 'current_year';
export type Period = { key: PeriodKey } | { key: 'custom'; from: string; to: string };
/** Rango cerrado [from, to] en 'YYYY-MM-DD'. */
export type Range = { from: string; to: string };

export const PERIOD_OPTIONS: { key: PeriodKey | 'custom'; label: string }[] = [
  { key: 'current_month', label: 'Mes actual' },
  { key: 'previous_month', label: 'Mes anterior' },
  { key: 'last_3_months', label: 'Últimos 3 meses' },
  { key: 'last_6_months', label: 'Últimos 6 meses' },
  { key: 'current_year', label: 'Año actual' },
  { key: 'custom', label: 'Personalizado' },
];

/** Día 1 del mes de `today` menos `monthsBack` meses (cruza años: enero − 1 = diciembre anterior). */
export function firstOfMonth(today: string, monthsBack: number): string {
  const [y, m] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 - monthsBack, 1)).toISOString().slice(0, 10);
}

/**
 * Rango del periodo. "Hasta" es hoy (no hay fechas futuras), salvo "Mes anterior", que es el mes completo.
 * "Últimos N meses" = el mes actual (hasta hoy) + los N − 1 meses completos anteriores.
 * Ej. hoy 2026-10-14: últimos 3 meses = 2026-08-01 … 2026-10-14.
 */
export function periodRange(period: Period, today: string): Range {
  if (!isValidISODate(today)) throw new Error(`Fecha inválida: ${today}`);
  switch (period.key) {
    case 'current_month':
      return { from: firstOfMonth(today, 0), to: today };
    case 'previous_month':
      return { from: firstOfMonth(today, 1), to: addDays(firstOfMonth(today, 0), -1) };
    case 'last_3_months':
      return { from: firstOfMonth(today, 2), to: today };
    case 'last_6_months':
      return { from: firstOfMonth(today, 5), to: today };
    case 'current_year':
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case 'custom':
      return { from: period.from, to: period.to };
  }
}

/** La misma fecha `n` meses antes; si ese día no existe en el mes, el último día del mes (31 oct − 1 = 30 sep). */
function monthsBefore(iso: string, n: number): string {
  const first = firstOfMonth(iso, n);
  const day = Math.min(Number(iso.slice(8)), daysInMonth(first.slice(0, 7)));
  return `${first.slice(0, 8)}${String(day).padStart(2, '0')}`;
}

/**
 * Periodo anterior para comparar: el mismo tramo corrido hacia atrás (decisión del usuario, 2026-10-17).
 * Mes actual 1–17 oct → 1–17 sep; mes anterior → el mes de antes completo; últimos N meses → N meses antes;
 * año actual → mismo tramo del año pasado; personalizado → los mismos días justo antes.
 */
export function previousRange(period: Period, today: string): Range {
  const { from, to } = periodRange(period, today);
  const back = (n: number) => ({ from: monthsBefore(from, n), to: monthsBefore(to, n) });
  switch (period.key) {
    case 'current_month':
      return back(1);
    case 'previous_month':
      return { from: firstOfMonth(from, 1), to: addDays(from, -1) };
    case 'last_3_months':
      return back(3);
    case 'last_6_months':
      return back(6);
    case 'current_year':
      return back(12);
    case 'custom':
      return { from: addDays(from, -(daysBetween(from, to) + 1)), to: addDays(from, -1) };
  }
}

export type MonthRange = Range & { month: string; label: string };

/** Los últimos `months` meses de calendario (el actual hasta hoy), del más antiguo al actual. */
export function lastMonths(today: string, months: number): MonthRange[] {
  return Array.from({ length: months }, (_, i) => {
    const back = months - 1 - i;
    const from = firstOfMonth(today, back);
    const to = back === 0 ? today : addDays(firstOfMonth(today, back - 1), -1);
    return { from, to, month: from.slice(0, 7), label: formatShortMonth(from) };
  });
}

/** "1 ago – 14 oct 2026"; si los años difieren: "1 nov 2026 – 15 ene 2027". */
export function formatRange({ from, to }: Range): string {
  const fromYear = from.slice(0, 4) === to.slice(0, 4) ? '' : ` ${from.slice(0, 4)}`;
  return `${formatShortDate(from)}${fromYear} – ${formatShortDate(to)} ${to.slice(0, 4)}`;
}

/** Título del Panel: "Octubre 2026", "Últimos 3 meses", "2026" o "Personalizado". */
export function periodLabel(period: Period, today: string): string {
  const { from } = periodRange(period, today);
  const month = (iso: string) => formatMonthYear(new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, 1));
  switch (period.key) {
    case 'current_month':
    case 'previous_month':
      return month(from);
    case 'current_year':
      return from.slice(0, 4);
    case 'custom':
      return 'Personalizado'; // las fechas van solo en la línea de debajo (formatRange), sin repetir
    default:
      return PERIOD_OPTIONS.find((o) => o.key === period.key)!.label;
  }
}

/** Errores del periodo personalizado, junto a cada campo. Vacío = válido. */
export function validateCustomRange(from: string, to: string, today: string): { from?: string; to?: string } {
  const errors: { from?: string; to?: string } = {};
  if (!isValidISODate(from)) errors.from = 'Fecha inválida.';
  if (!isValidISODate(to)) errors.to = 'Fecha inválida.';
  else if (to > today) errors.to = 'La fecha final no puede ser posterior a hoy.';
  if (!errors.from && !errors.to && from > to) errors.from = 'La fecha inicial no puede ser posterior a la final.';
  return errors;
}
