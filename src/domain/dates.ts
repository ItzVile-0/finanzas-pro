// Fechas contables 'YYYY-MM-DD'. Meses fijos: Intl varía entre Node y Hermes ("10 de oct", "sept").
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Mes corto de una fecha: '2026-10-14' → "oct". */
export function formatShortMonth(iso: string): string {
  return formatShortDate(iso).split(' ')[1];
}

export function formatShortDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const month = match ? Number(match[2]) : 0;
  const day = match ? Number(match[3]) : 0;
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(`Fecha inválida (se espera YYYY-MM-DD): ${iso}`);
  }
  return `${day} ${MONTHS[month - 1]}`;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Fecha contable de hoy en la hora LOCAL del teléfono. Nunca toISOString():
 * en Colombia (UTC−5) después de las 7 p. m. daría el día siguiente.
 */
export function todayLocal(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** true si es 'YYYY-MM-DD' y existe en el calendario (rechaza 2026-02-30). */
export function isValidISODate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/** Mes y año en la hora local del teléfono: "Octubre 2026". */
export function formatMonthYear(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new Error('Fecha inválida');
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

/** 'YYYY-MM-DD' + n días (n negativo resta). En UTC para no depender de la zona horaria ni del horario de verano. */
export function addDays(iso: string, n: number): string {
  if (!isValidISODate(iso)) throw new Error(`Fecha inválida (se espera YYYY-MM-DD): ${iso}`);
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Días de `from` a `to` (negativo si `to` es antes). En UTC, como addDays. */
export function daysBetween(from: string, to: string): number {
  if (!isValidISODate(from) || !isValidISODate(to)) throw new Error(`Fecha inválida (se espera YYYY-MM-DD): ${from} / ${to}`);
  const utc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8)));
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** '2026-10-14' → "14 de octubre de 2026" (para el lector de pantalla). */
export function formatLongDate(iso: string): string {
  if (!isValidISODate(iso)) throw new Error(`Fecha inválida (se espera YYYY-MM-DD): ${iso}`);
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${MONTH_NAMES[m - 1].toLowerCase()} de ${y}`;
}

/** Título del día en listas: "Hoy", "Ayer", "12 oct" o, si es de otro año, "12 oct 2025". */
export function dayLabel(iso: string, today: string): string {
  if (iso === today) return 'Hoy';
  if (iso === addDays(today, -1)) return 'Ayer';
  return iso.slice(0, 4) === today.slice(0, 4) ? formatShortDate(iso) : `${formatShortDate(iso)} ${iso.slice(0, 4)}`;
}

/** Agrupa por fecha contable conservando el orden de entrada (ya viene del más reciente al más antiguo). */
export function groupByDay<T extends { date: string }>(items: readonly T[], today: string): { date: string; title: string; data: T[] }[] {
  const groups: { date: string; title: string; data: T[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.date === item.date) last.data.push(item);
    else groups.push({ date: item.date, title: dayLabel(item.date, today), data: [item] });
  }
  return groups;
}
