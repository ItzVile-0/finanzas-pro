import { addDays, dayLabel, daysBetween, formatLongDate, formatMonthYear, formatShortDate, groupByDay, isValidISODate, todayLocal } from './dates';

describe('todayLocal', () => {
  const originalTZ = process.env.TZ;
  afterAll(() => {
    process.env.TZ = originalTZ;
  });

  it('2026-10-31 21:00 en Bogotá → 2026-10-31 (toISOString daría 2026-11-01)', () => {
    process.env.TZ = 'America/Bogota';
    const now = new Date('2026-11-01T02:00:00Z'); // = 31 oct 21:00 en UTC−5
    expect(now.toISOString().slice(0, 10)).toBe('2026-11-01');
    expect(todayLocal(now)).toBe('2026-10-31');
  });

  it('rellena mes y día con cero', () => {
    process.env.TZ = 'America/Bogota';
    expect(todayLocal(new Date(2026, 0, 5, 8, 0))).toBe('2026-01-05');
  });
});

describe('isValidISODate', () => {
  it('acepta fechas reales y rechaza inexistentes o mal formadas', () => {
    expect(isValidISODate('2026-10-31')).toBe(true);
    expect(isValidISODate('2028-02-29')).toBe(true);
    expect(isValidISODate('2026-02-29')).toBe(false);
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(isValidISODate('31/10/2026')).toBe(false);
    expect(isValidISODate('')).toBe(false);
  });
});

describe('formatMonthYear', () => {
  it('usa la fecha local', () => {
    expect(formatMonthYear(new Date(2026, 9, 14))).toBe('Octubre 2026');
    expect(formatMonthYear(new Date(2027, 0, 1, 0, 0))).toBe('Enero 2027');
    expect(formatMonthYear(new Date(2026, 11, 31, 23, 59))).toBe('Diciembre 2026');
  });
  it('rechaza fechas inválidas', () => {
    expect(() => formatMonthYear(new Date('x'))).toThrow();
  });
});

describe('formatShortDate', () => {
  it('formatea día sin cero inicial y mes corto', () => {
    expect(formatShortDate('2026-10-10')).toBe('10 oct');
    expect(formatShortDate('2026-01-01')).toBe('1 ene');
    expect(formatShortDate('2026-09-05')).toBe('5 sep');
    expect(formatShortDate('2026-12-31')).toBe('31 dic');
  });

  it('rechaza formatos inválidos', () => {
    expect(() => formatShortDate('2026-13-01')).toThrow();
    expect(() => formatShortDate('2026-10-00')).toThrow();
    expect(() => formatShortDate('10/10/2026')).toThrow();
    expect(() => formatShortDate('')).toThrow();
  });
});

describe('addDays', () => {
  it('"Ayer" cruza mes, año y bisiesto', () => {
    expect(addDays('2026-10-14', -1)).toBe('2026-10-13');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('rechaza una fecha inválida', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow();
  });
});

describe('formatLongDate', () => {
  it('fecha completa en español', () => {
    expect(formatLongDate('2026-10-14')).toBe('14 de octubre de 2026');
    expect(formatLongDate('2028-02-29')).toBe('29 de febrero de 2028');
    expect(() => formatLongDate('2026-02-30')).toThrow();
  });
});

describe('daysBetween', () => {
  it('cuenta días entre fechas, cruzando meses y años; negativo hacia atrás', () => {
    expect(daysBetween('2026-10-14', '2026-10-14')).toBe(0);
    expect(daysBetween('2026-10-14', '2026-10-21')).toBe(7);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2028-03-01', '2028-02-28')).toBe(-2);
  });
  it('rechaza fechas inválidas', () => {
    expect(() => daysBetween('2026-02-30', '2026-03-01')).toThrow();
  });
});

describe('dayLabel y groupByDay (Movimientos por día)', () => {
  const today = '2026-10-17';
  it('Hoy, Ayer, fecha corta y otro año', () => {
    expect(dayLabel('2026-10-17', today)).toBe('Hoy');
    expect(dayLabel('2026-10-16', today)).toBe('Ayer');
    expect(dayLabel('2026-10-12', today)).toBe('12 oct');
    expect(dayLabel('2025-12-31', today)).toBe('31 dic 2025');
    expect(dayLabel('2026-12-31', '2027-01-01')).toBe('Ayer'); // ayer cruzando el año
  });

  it('agrupa días seguidos y conserva el orden', () => {
    const items = [{ id: 'a', date: '2026-10-17' }, { id: 'b', date: '2026-10-17' }, { id: 'c', date: '2026-10-12' }, { id: 'd', date: '2025-12-31' }];
    expect(groupByDay(items, today).map((g) => [g.title, g.data.map((i) => i.id)])).toEqual([
      ['Hoy', ['a', 'b']],
      ['12 oct', ['c']],
      ['31 dic 2025', ['d']],
    ]);
    expect(groupByDay([], today)).toEqual([]);
  });
});
