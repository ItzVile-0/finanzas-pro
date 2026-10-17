// Notificaciones locales (sin servidor): qué avisar y cuándo. TS puro; programar en el teléfono vive en src/db/notifications.ts.
// Los datos solo cambian dentro de la app y la app vuelve a planear al iniciar, al salir y tras cada cambio relevante:
// por eso un resumen calculado ahora sigue siendo correcto cuando llega.
import { BACKUP_REMINDER_DAYS, localDateOf } from './backup';
import { addDays, daysBetween } from './dates';
import type { Transaction } from './ledger';
import { formatCOP, sum } from './money';
import { followingDue, type Recurring } from './recurring';
import { isPersonalExpense, isPersonalIncome } from './summary';

export type NotifyKind = 'recurring' | 'daily' | 'backup' | 'weekly';
export const NOTIFY_KINDS: NotifyKind[] = ['recurring', 'daily', 'backup', 'weekly'];
/** Interruptor y hora ("HH:MM") de cada aviso; showAmounts = montos en el texto (por defecto no: se ven en la pantalla de bloqueo). */
export type NotificationPrefs = Record<NotifyKind, { on: boolean; time: string }> & { showAmounts: boolean };
export const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  recurring: { on: false, time: '08:00' },
  daily: { on: false, time: '20:00' },
  backup: { on: false, time: '09:00' },
  weekly: { on: false, time: '20:00' },
  showAmounts: false,
};
/** Recurrentes: todos los vencimientos de los próximos HORIZON_DAYS días; nunca más de MAX_SCHEDULED avisos en total. */
export const HORIZON_DAYS = 60;
export const MAX_SCHEDULED = 50;

const isTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

/** JSON guardado en settings; lo inválido (entrada por entrada) usa el valor por defecto. */
export function parseNotificationPrefs(value: string | undefined): NotificationPrefs {
  let raw: unknown = null;
  try {
    raw = value ? JSON.parse(value) : null;
  } catch {
    raw = null;
  }
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, { on?: unknown; time?: unknown } | undefined>;
  const prefs = { ...DEFAULT_NOTIFICATIONS, showAmounts: (r as { showAmounts?: unknown }).showAmounts === true };
  for (const k of NOTIFY_KINDS) {
    const e = r[k];
    prefs[k] = { on: e?.on === true, time: isTime(e?.time) ? e.time : DEFAULT_NOTIFICATIONS[k].time };
  }
  return prefs;
}

/**
 * Aviso de una sola vez (fecha local y hora) o que se repite todos los días. `url` = pantalla que abre al tocarlo
 * (un pago recurrente lleva su id: si ya no existe, se abre la lista; ver notificationTarget).
 */
export type Planned =
  | { id: string; kind: NotifyKind; date: string; time: string; title: string; body: string; url: string }
  | { id: string; kind: 'daily'; repeat: 'daily'; time: string; title: string; body: string; url: string };

export const NOTIFY_URL = { daily: '/movimiento-nuevo', backup: '/respaldo', weekly: '/informes', recurringList: '/recurrentes' } as const;
export const recurringUrl = (id: string) => `/recurrente?id=${encodeURIComponent(id)}`;

/**
 * Pantalla a abrir con el `url` de un aviso tocado: solo las de la app (un dato ajeno o roto abre el Inicio) y, si es un
 * pago recurrente que ya no existe, la lista de pagos.
 */
export function notificationTarget(url: unknown, recurringExists: (id: string) => boolean): string {
  if (typeof url !== 'string') return '/';
  const m = /^\/recurrente\?id=(.+)$/.exec(url);
  if (m) {
    let id: string;
    try {
      id = decodeURIComponent(m[1]);
    } catch {
      return NOTIFY_URL.recurringList;
    }
    return recurringExists(id) ? url : NOTIFY_URL.recurringList;
  }
  return (Object.values(NOTIFY_URL) as string[]).includes(url) ? url : '/';
}

/** Domingo = 0. */
const weekday = (iso: string) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8)))).getUTCDay();

/**
 * Todos los avisos a programar desde ahora (`today` + `now` "HH:MM"). Los que ya pasaron no se incluyen. Si son más de
 * MAX_SCHEDULED quedan los más cercanos (el diario cuenta como uno).
 */
export function planNotifications(ctx: {
  prefs: NotificationPrefs;
  today: string;
  now: string;
  recurring: readonly Recurring[];
  transactions: readonly Transaction[];
  lastBackupAt: string | null;
}): Planned[] {
  const { prefs, today, now } = ctx;
  const money = (v: number) => (prefs.showAmounts ? formatCOP(v) : null);
  const future = (date: string, time: string) => date > today || (date === today && time > now);
  const last = addDays(today, HORIZON_DAYS);
  const once: Extract<Planned, { date: string }>[] = [];

  if (prefs.recurring.on) {
    const time = prefs.recurring.time;
    for (const r of ctx.recurring) {
      if (!r.active) continue;
      for (let due = r.next_due_date; due <= last; due = followingDue(r.anchor_date, due, r.frequency)) {
        const amount = money(r.estimated_amount);
        const body = amount ? `${r.concept} · ${amount} estimado` : r.concept;
        const before = addDays(due, -1);
        const url = recurringUrl(r.id);
        if (future(before, time)) once.push({ id: `recurring:${r.id}:${due}:before`, kind: 'recurring', date: before, time, title: 'Mañana vence un pago', body, url });
        if (future(due, time)) once.push({ id: `recurring:${r.id}:${due}:due`, kind: 'recurring', date: due, time, title: 'Hoy vence un pago', body, url });
      }
    }
  }

  if (prefs.backup.on && ctx.transactions.length > 0) {
    // Mismo umbral que la tarjeta del Inicio: más de 7 días sin copia (o nunca). Si ya pasó, el próximo momento posible.
    const lastDate = ctx.lastBackupAt ? localDateOf(ctx.lastBackupAt) : null;
    let date = lastDate ? addDays(lastDate, BACKUP_REMINDER_DAYS + 1) : today;
    if (date < today) date = today;
    if (!future(date, prefs.backup.time)) date = addDays(today, 1);
    const days = lastDate ? daysBetween(lastDate, date) : null;
    once.push({
      id: 'backup',
      kind: 'backup',
      date,
      time: prefs.backup.time,
      title: 'Haz una copia de seguridad',
      body: days === null ? 'Aún no has exportado ninguna copia de tus datos.' : `Han pasado ${days} días desde tu última copia.`,
      url: NOTIFY_URL.backup,
    });
  }

  if (prefs.weekly.on) {
    // Cada domingo del horizonte, con la semana que termina ese día (lunes a domingo).
    for (let d = addDays(today, (7 - weekday(today)) % 7); d <= last; d = addDays(d, 7)) {
      if (!future(d, prefs.weekly.time)) continue;
      const from = addDays(d, -6);
      const week = ctx.transactions.filter((t) => t.date >= from && t.date <= d);
      const income = sum(week.filter(isPersonalIncome).map((t) => t.amount));
      const expense = sum(week.filter(isPersonalExpense).map((t) => t.amount));
      const body = prefs.showAmounts
        ? `Ingresos ${formatCOP(income)} · Gastos ${formatCOP(expense)}`
        : week.length > 0
          ? `Registraste ${week.length} ${week.length === 1 ? 'movimiento' : 'movimientos'}. Toca para ver tu semana.`
          : 'No registraste movimientos esta semana. Toca para ponerte al día.';
      once.push({ id: `weekly:${d}`, kind: 'weekly', date: d, time: prefs.weekly.time, title: 'Tu resumen de la semana', body, url: NOTIFY_URL.weekly });
    }
  }

  const daily: Planned[] = prefs.daily.on
    ? [{ id: 'daily', kind: 'daily', repeat: 'daily', time: prefs.daily.time, title: '¿Registraste tus gastos de hoy?', body: 'Anótalos ahora y mantén tus cuentas al día.', url: NOTIFY_URL.daily }]
    : [];
  const at = (p: { date: string; time: string }) => `${p.date} ${p.time}`;
  const nearest = once.sort((a, b) => (at(a) < at(b) ? -1 : at(a) > at(b) ? 1 : 0)).slice(0, MAX_SCHEDULED - daily.length);
  return [...daily, ...nearest];
}
