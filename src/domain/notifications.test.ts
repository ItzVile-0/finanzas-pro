import type { Transaction } from './ledger';
import { DEFAULT_NOTIFICATIONS, HORIZON_DAYS, MAX_SCHEDULED, notificationTarget, parseNotificationPrefs, planNotifications, type NotificationPrefs, type Planned } from './notifications';
import type { Recurring } from './recurring';

const TODAY = '2026-10-17'; // sábado
const rec = (id: string, o: Partial<Recurring> = {}): Recurring => ({
  id, scope: 'personal', concept: `[PRUEBA] ${id}`, estimated_amount: 900_000, frequency: 'monthly', anchor_date: '2026-10-20',
  next_due_date: '2026-10-20', account_id: 'banco', category_id: 'cat-p-vivienda', active: true, ...o,
});
const tx = (date: string, kind: Transaction['kind'], amount: number, scope: Transaction['scope'] = 'personal'): Transaction => ({
  id: `${date}-${kind}-${amount}`, scope, kind, amount, date, account_id: 'banco', to_account_id: null, category_id: 'cat', note: '', created_at: '',
});
const on = (o: Partial<NotificationPrefs>): NotificationPrefs => ({ ...DEFAULT_NOTIFICATIONS, ...o });
const plan = (prefs: NotificationPrefs, o: Partial<Parameters<typeof planNotifications>[0]> = {}) =>
  planNotifications({ prefs, today: TODAY, now: '10:00', recurring: [], transactions: [], lastBackupAt: null, ...o });
const when = (p: Planned) => ('date' in p ? `${p.date} ${p.time}` : `diario ${p.time}`);

describe('planNotifications', () => {
  it('apagadas: nada', () => {
    expect(plan(DEFAULT_NOTIFICATIONS, { recurring: [rec('arriendo')], transactions: [tx(TODAY, 'expense', 1)] })).toEqual([]);
  });

  it('recurrentes: el día antes y el día de TODOS los vencimientos de los próximos 60 días; pausados no; sin montos por defecto', () => {
    const p = plan(on({ recurring: { on: true, time: '08:00' } }), { recurring: [rec('arriendo'), rec('pausado', { active: false })] });
    // 20 oct y 20 nov; el 20 dic (y su día antes) quedan fuera de los 60 días (hasta el 16 dic).
    expect(p.map(when)).toEqual(['2026-10-19 08:00', '2026-10-20 08:00', '2026-11-19 08:00', '2026-11-20 08:00']);
    expect(p.every((n) => n.body === '[PRUEBA] arriendo')).toBe(true); // sin monto
    expect(p.map((n) => n.title)).toEqual(['Mañana vence un pago', 'Hoy vence un pago', 'Mañana vence un pago', 'Hoy vence un pago']);
  });

  it('semanal: no se queda sin avisos si pasan semanas sin abrir la app', () => {
    const p = plan(on({ recurring: { on: true, time: '08:00' } }), { recurring: [rec('gym', { frequency: 'weekly', anchor_date: '2026-10-18', next_due_date: '2026-10-18' })] });
    const dues = p.filter((n) => n.title === 'Hoy vence un pago').map((n) => ('date' in n ? n.date : ''));
    expect(dues[0]).toBe('2026-10-18');
    expect(dues.at(-1)).toBe('2026-12-13'); // último domingo dentro de los 60 días (16 dic)
    expect(dues).toHaveLength(9);
  });

  it('lo que ya pasó hoy no se programa; con "mostrar montos", el monto va en el texto', () => {
    const p = plan(on({ recurring: { on: true, time: '08:00' }, showAmounts: true }), { recurring: [rec('hoy', { next_due_date: TODAY, anchor_date: TODAY })] });
    expect(p.find((n) => 'date' in n && n.date === TODAY)).toBeUndefined(); // las 8:00 ya pasaron (son las 10:00)
    expect(p[0].body).toMatch(/900\.000 estimado/);
  });

  it(`tope de ${MAX_SCHEDULED} avisos en total, los más cercanos primero (el diario cuenta como uno)`, () => {
    const many = Array.from({ length: 10 }, (_, i) => rec(`r${i}`, { frequency: 'weekly', anchor_date: '2026-10-18', next_due_date: '2026-10-18' }));
    const p = plan(on({ recurring: { on: true, time: '08:00' }, daily: { on: true, time: '20:00' } }), { recurring: many });
    expect(p).toHaveLength(MAX_SCHEDULED);
    expect(p[0]).toMatchObject({ id: 'daily', repeat: 'daily' });
    const dates = p.slice(1).map(when);
    expect([...dates].sort()).toEqual(dates);
    // 10 pagos semanales: 18 oct (el día antes ya pasó), 24 y 25 oct, 31 oct y 9 del 1 nov = 49 + el diario.
    expect(dates.at(-1)).toBe('2026-11-01 08:00');
  });

  it('copia: a los 8 días de la última (igual que el Inicio), o mañana si ya pasó; nunca sin movimientos', () => {
    const prefs = on({ backup: { on: true, time: '09:00' } });
    const moves = [tx('2026-10-01', 'expense', 1)];
    expect(plan(prefs, { transactions: [] })).toEqual([]);
    expect(plan(prefs, { transactions: moves, lastBackupAt: '2026-10-15T15:00:00' }).map(when)).toEqual(['2026-10-23 09:00']);
    // Nunca exportada o vencida: hoy a las 9:00 ya pasó → mañana.
    expect(plan(prefs, { transactions: moves }).map(when)).toEqual(['2026-10-18 09:00']);
    expect(plan(prefs, { transactions: moves, lastBackupAt: '2026-09-01T12:00:00' })[0].body).toMatch(/47 días/);
  });

  it('resumen semanal: cada domingo a la hora elegida, con la semana de lunes a domingo; personal, sin la tienda', () => {
    const txs = [tx('2026-10-13', 'income', 100_000), tx('2026-10-18', 'expense', 30_000), tx('2026-10-14', 'income', 999_000, 'business'), tx('2026-10-11', 'expense', 5)];
    const p = plan(on({ weekly: { on: true, time: '20:00' }, showAmounts: true }), { transactions: txs });
    expect(p[0]).toMatchObject({ date: '2026-10-18', time: '20:00' });
    expect(p[0].body).toMatch(/Ingresos \$\s100\.000 · Gastos \$\s30\.000/);
    expect(p).toHaveLength(9); // domingos hasta el 16 dic (horizonte de 60 días)
    expect(plan(on({ weekly: { on: true, time: '20:00' } }), { transactions: txs })[0].body).not.toMatch(/\$/);
  });

  it('el horizonte es de 60 días', () => {
    expect(HORIZON_DAYS).toBe(60);
  });
});

describe('parseNotificationPrefs', () => {
  it('JSON roto, vacío o con horas inválidas usa los valores por defecto', () => {
    expect(parseNotificationPrefs(undefined)).toEqual(DEFAULT_NOTIFICATIONS);
    expect(parseNotificationPrefs('{')).toEqual(DEFAULT_NOTIFICATIONS);
    const p = parseNotificationPrefs(JSON.stringify({ daily: { on: true, time: '25:00' }, weekly: { on: 'sí', time: '21:30' }, showAmounts: true }));
    expect(p.daily).toEqual({ on: true, time: '20:00' });
    expect(p.weekly).toEqual({ on: false, time: '21:30' });
    expect(p.showAmounts).toBe(true);
  });
});

describe('al tocar un aviso', () => {
  it('cada aviso lleva su pantalla: el pago, Nuevo movimiento, Copia de seguridad e Informes', () => {
    const all = on({
      recurring: { on: true, time: '08:00' },
      daily: { on: true, time: '20:00' },
      backup: { on: true, time: '09:00' },
      weekly: { on: true, time: '20:00' },
    });
    const p = plan(all, { recurring: [rec('arriendo')], transactions: [tx('2026-10-01', 'expense', 1)] });
    const urlOf = (kind: string) => p.find((n) => n.kind === kind)?.url;
    expect(urlOf('recurring')).toBe('/recurrente?id=arriendo');
    expect(urlOf('daily')).toBe('/movimiento-nuevo');
    expect(urlOf('backup')).toBe('/respaldo');
    expect(urlOf('weekly')).toBe('/informes');
  });

  it('un pago que ya no existe abre la lista; un dato ajeno abre el Inicio', () => {
    const exists = (id: string) => id === 'arriendo';
    expect(notificationTarget('/recurrente?id=arriendo', exists)).toBe('/recurrente?id=arriendo');
    expect(notificationTarget('/recurrente?id=borrado', exists)).toBe('/recurrentes');
    expect(notificationTarget('/informes', exists)).toBe('/informes');
    expect(notificationTarget('https://otro.sitio', exists)).toBe('/');
    expect(notificationTarget(undefined, exists)).toBe('/');
    expect(notificationTarget('/recurrente?id=%E0%A4%A', exists)).toBe('/recurrentes'); // id roto
  });
});
