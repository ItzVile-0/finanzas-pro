import { addMonths, daysInMonth, monthGrid, weekdayOrder } from './calendar';

describe('daysInMonth', () => {
  it('meses de 30 y 31 días y febrero (bisiesto y no)', () => {
    expect(daysInMonth('2026-10')).toBe(31);
    expect(daysInMonth('2026-11')).toBe(30);
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2028-02')).toBe(29);
    expect(daysInMonth('2100-02')).toBe(28); // divisible por 100 y no por 400
    expect(daysInMonth('2000-02')).toBe(29); // divisible por 400
  });

  it('rechaza un mes inválido', () => {
    expect(() => daysInMonth('2026-13')).toThrow();
    expect(() => daysInMonth('2026-1')).toThrow();
  });
});

describe('addMonths', () => {
  it('cruza años hacia adelante y hacia atrás', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2027-01', -1)).toBe('2026-12');
    expect(addMonths('2026-10', -10)).toBe('2025-12');
  });
});

describe('monthGrid (semanas desde el domingo)', () => {
  it('octubre 2026 empieza en jueves: 4 casillas vacías, 5 semanas', () => {
    const g = monthGrid('2026-10');
    expect(g).toHaveLength(5);
    expect(g[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03']);
    expect(g[4]).toEqual(['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31']);
  });

  it('febrero 2026 empieza en domingo y cabe en 4 semanas exactas', () => {
    const g = monthGrid('2026-02');
    expect(g).toHaveLength(4);
    expect(g[0][0]).toBe('2026-02-01');
    expect(g[3][6]).toBe('2026-02-28');
  });

  it('agosto 2026 empieza en sábado y necesita 6 semanas', () => {
    const g = monthGrid('2026-08');
    expect(g).toHaveLength(6);
    expect(g[0]).toEqual([null, null, null, null, null, null, '2026-08-01']);
    expect(g[5].filter(Boolean)).toEqual(['2026-08-30', '2026-08-31']);
  });

  it('febrero 2028 (bisiesto) incluye el 29; cada semana tiene 7 casillas', () => {
    const g = monthGrid('2028-02');
    expect(g.flat().filter(Boolean)).toHaveLength(29);
    expect(g.flat()).toContain('2028-02-29');
    expect(g.every((w) => w.length === 7)).toBe(true);
  });
});

describe('monthGrid con semanas desde el lunes', () => {
  it('octubre 2026 (empieza en jueves): 3 casillas vacías', () => {
    const g = monthGrid('2026-10', 'monday');
    expect(g[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(g.flat().filter(Boolean)).toHaveLength(31);
  });

  it('un mes que empieza en domingo deja 6 casillas vacías; febrero 2027 empieza en lunes y cabe en 4 semanas', () => {
    expect(monthGrid('2026-02', 'monday')[0]).toEqual([null, null, null, null, null, null, '2026-02-01']);
    const feb = monthGrid('2027-02', 'monday');
    expect(feb).toHaveLength(4);
    expect(feb[0][0]).toBe('2027-02-01');
    expect(feb[3][6]).toBe('2027-02-28');
  });

  it('el orden de los encabezados coincide con la cuadrícula', () => {
    expect(weekdayOrder('sunday')).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(weekdayOrder('monday')).toEqual([1, 2, 3, 4, 5, 6, 0]);
    // la primera columna con lunes es un lunes de verdad
    const g = monthGrid('2026-10', 'monday');
    expect(new Date(`${g[1][0]}T12:00:00Z`).getUTCDay()).toBe(1);
  });
});
