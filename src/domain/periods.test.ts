import { formatRange, lastMonths, periodLabel, periodRange, previousRange, validateCustomRange, type Period } from './periods';

const range = (key: Exclude<Period['key'], 'custom'>, today: string) => periodRange({ key }, today);

describe('periodRange', () => {
  it('hoy 14 oct 2026', () => {
    const today = '2026-10-14';
    expect(range('current_month', today)).toEqual({ from: '2026-10-01', to: '2026-10-14' });
    expect(range('previous_month', today)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    // Últimos 3 meses = mes actual hasta hoy + 2 meses completos anteriores.
    expect(range('last_3_months', today)).toEqual({ from: '2026-08-01', to: '2026-10-14' });
    expect(range('last_6_months', today)).toEqual({ from: '2026-05-01', to: '2026-10-14' });
    expect(range('current_year', today)).toEqual({ from: '2026-01-01', to: '2026-10-14' });
  });

  it('cambio de año: hoy 15 ene 2027', () => {
    const today = '2027-01-15';
    expect(range('previous_month', today)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    expect(range('last_3_months', today)).toEqual({ from: '2026-11-01', to: '2027-01-15' });
    expect(range('last_6_months', today)).toEqual({ from: '2026-08-01', to: '2027-01-15' });
    expect(range('current_year', today)).toEqual({ from: '2027-01-01', to: '2027-01-15' });
  });

  it('febrero normal y bisiesto', () => {
    expect(range('previous_month', '2026-03-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(range('previous_month', '2028-03-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('hoy 31: el mes anterior no se desborda', () => {
    expect(range('previous_month', '2026-03-31')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(range('last_3_months', '2026-05-31')).toEqual({ from: '2026-03-01', to: '2026-05-31' });
  });

  it('personalizado devuelve sus fechas; hoy inválido lanza error', () => {
    expect(periodRange({ key: 'custom', from: '2026-08-02', to: '2026-10-01' }, '2026-10-14')).toEqual({ from: '2026-08-02', to: '2026-10-01' });
    expect(() => range('current_month', '2026-02-30')).toThrow();
  });
});

describe('periodLabel y formatRange', () => {
  const today = '2026-10-14';
  it('nombres del encabezado', () => {
    expect(periodLabel({ key: 'current_month' }, today)).toBe('Octubre 2026');
    expect(periodLabel({ key: 'previous_month' }, '2027-01-15')).toBe('Diciembre 2026');
    expect(periodLabel({ key: 'last_3_months' }, today)).toBe('Últimos 3 meses');
    expect(periodLabel({ key: 'last_6_months' }, today)).toBe('Últimos 6 meses');
    expect(periodLabel({ key: 'current_year' }, today)).toBe('2026');
    expect(periodLabel({ key: 'custom', from: '2026-08-01', to: '2026-10-14' }, today)).toBe('Personalizado');
    expect(formatRange({ from: '2026-08-01', to: '2026-10-14' })).toBe('1 ago – 14 oct 2026');
  });

  it('rango que cruza años muestra ambos años', () => {
    expect(formatRange({ from: '2026-11-01', to: '2027-01-15' })).toBe('1 nov 2026 – 15 ene 2027');
  });
});

describe('validateCustomRange', () => {
  const today = '2026-10-14';
  it('válido, incluso un solo día y hasta = hoy', () => {
    expect(validateCustomRange('2026-08-01', '2026-10-14', today)).toEqual({});
    expect(validateCustomRange('2026-10-14', '2026-10-14', today)).toEqual({});
  });

  it('desde > hasta, hasta en el futuro o fecha inválida: error en su campo', () => {
    expect(validateCustomRange('2026-10-10', '2026-10-01', today)).toEqual({ from: 'La fecha inicial no puede ser posterior a la final.' });
    expect(validateCustomRange('2026-10-01', '2026-10-15', today)).toEqual({ to: 'La fecha final no puede ser posterior a hoy.' });
    expect(validateCustomRange('2026-02-30', '2026-10-01', today)).toEqual({ from: 'Fecha inválida.' });
    expect(validateCustomRange('2026-10-01', '', today)).toEqual({ to: 'Fecha inválida.' });
  });
});

describe('previousRange (mismo tramo corrido hacia atrás)', () => {
  const prev = (key: Exclude<Period['key'], 'custom'>, today: string) => previousRange({ key }, today);

  it('mes actual → los mismos días del mes anterior', () => {
    expect(prev('current_month', '2026-10-17')).toEqual({ from: '2026-09-01', to: '2026-09-17' });
    expect(prev('current_month', '2026-01-10')).toEqual({ from: '2025-12-01', to: '2025-12-10' }); // cruza año
  });

  it('el día que no existe pasa al último día del mes', () => {
    expect(prev('current_month', '2026-10-31')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(prev('current_month', '2026-03-31')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(prev('current_month', '2028-03-30')).toEqual({ from: '2028-02-01', to: '2028-02-29' }); // bisiesto
    expect(prev('current_year', '2028-02-29')).toEqual({ from: '2027-01-01', to: '2027-02-28' });
  });

  it('mes anterior → el mes de antes completo', () => {
    expect(prev('previous_month', '2026-10-17')).toEqual({ from: '2026-08-01', to: '2026-08-31' });
    expect(prev('previous_month', '2026-03-05')).toEqual({ from: '2026-01-01', to: '2026-01-31' });
  });

  it('últimos 3 y 6 meses, y año actual', () => {
    expect(prev('last_3_months', '2026-10-17')).toEqual({ from: '2026-05-01', to: '2026-07-17' });
    expect(prev('last_6_months', '2026-10-17')).toEqual({ from: '2025-11-01', to: '2026-04-17' });
    expect(prev('current_year', '2026-10-17')).toEqual({ from: '2025-01-01', to: '2025-10-17' });
  });

  it('personalizado → los mismos días justo antes', () => {
    expect(previousRange({ key: 'custom', from: '2026-10-10', to: '2026-10-19' }, '2026-10-20')).toEqual({ from: '2026-09-30', to: '2026-10-09' });
    expect(previousRange({ key: 'custom', from: '2026-03-01', to: '2026-03-01' }, '2026-10-20')).toEqual({ from: '2026-02-28', to: '2026-02-28' });
  });
});

describe('lastMonths', () => {
  it('del más antiguo al actual, el actual hasta hoy', () => {
    expect(lastMonths('2027-01-15', 3)).toEqual([
      { from: '2026-11-01', to: '2026-11-30', month: '2026-11', label: 'nov' },
      { from: '2026-12-01', to: '2026-12-31', month: '2026-12', label: 'dic' },
      { from: '2027-01-01', to: '2027-01-15', month: '2027-01', label: 'ene' },
    ]);
  });
});
