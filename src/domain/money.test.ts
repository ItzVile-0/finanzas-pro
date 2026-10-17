import { formatCOP, formatCOPInput, parseCOP, sum } from './money';

describe('formatCOPInput', () => {
  it('agrupa miles mientras se escribe', () => {
    expect(formatCOPInput('3000000')).toBe('3.000.000');
    expect(formatCOPInput('3.0000', '3.000')).toBe('30.000');
    expect(formatCOPInput('950', '95')).toBe('950');
    expect(formatCOPInput('$ 1500000')).toBe('1.500.000');
  });

  it('al borrar un dígito reagrupa', () => {
    expect(formatCOPInput('30.00', '30.000')).toBe('3.000');
    expect(formatCOPInput('', '5')).toBe('');
  });

  it('quita ceros a la izquierda pero conserva un 0', () => {
    expect(formatCOPInput('0')).toBe('0');
    expect(formatCOPInput('0050', '005')).toBe('50');
  });

  it('nunca cambia el valor: el resultado se lee igual con parseCOP', () => {
    for (const t of ['1', '12', '123', '1234', '1234567', '987654321']) {
      expect(parseCOP(formatCOPInput(t))).toBe(Number(t));
    }
  });

  it('deja intacto lo que parseCOP debe rechazar (decimales, texto)', () => {
    expect(formatCOPInput('1500,50')).toBe('1500,50');
    expect(formatCOPInput('12abc')).toBe('12abc');
    expect(formatCOPInput('1500.50', '')).toBe('1500.50');
    expect(() => parseCOP(formatCOPInput('1500.50', ''))).toThrow('Sin decimales');
  });
});

describe('parseCOP', () => {
  it('acepta con y sin separadores y con signo $', () => {
    expect(parseCOP('1500000')).toBe(1_500_000);
    expect(parseCOP('1.500.000')).toBe(1_500_000);
    expect(parseCOP('$ 1.500.000')).toBe(1_500_000);
    expect(parseCOP(' 950 ')).toBe(950);
  });

  it('rechaza decimales, texto, vacío, cero y negativos con mensaje claro', () => {
    expect(() => parseCOP('1500,50')).toThrow('Sin decimales');
    expect(() => parseCOP('1500.5')).toThrow('Sin decimales');
    expect(() => parseCOP('abc')).toThrow('Solo números');
    expect(() => parseCOP('1.50.000')).toThrow('Solo números');
    expect(() => parseCOP('')).toThrow('Escribe un valor');
    expect(() => parseCOP('   ')).toThrow('Escribe un valor');
    expect(() => parseCOP('0')).toThrow('mayor que 0');
    expect(() => parseCOP('-5000')).toThrow('negativos');
    expect(() => parseCOP('99999999999999999999')).toThrow('demasiado grande');
  });

  it('allowZero permite 0 (saldo inicial)', () => {
    expect(parseCOP('0', { allowZero: true })).toBe(0);
  });
});

// Intl usa espacios no separables; se normalizan para comparar dígitos y separadores.
const fmt = (v: number) => formatCOP(v).replace(/\s/g, ' ');

describe('formatCOP', () => {
  it('formatea positivo, cero, negativo y millones', () => {
    expect(fmt(1500)).toBe('$ 1.500');
    expect(fmt(0)).toBe('$ 0');
    expect(fmt(-25000)).toBe('-$ 25.000');
    expect(fmt(1234567)).toBe('$ 1.234.567');
  });

  it('rechaza decimales, NaN e infinito', () => {
    expect(() => formatCOP(10.5)).toThrow();
    expect(() => formatCOP(NaN)).toThrow();
    expect(() => formatCOP(Infinity)).toThrow();
  });
});

describe('sum', () => {
  it('suma enteros, incluidos negativos y lista vacía', () => {
    expect(sum([1_000_000, 250_000, -50_000])).toBe(1_200_000);
    expect(sum([])).toBe(0);
  });

  it('rechaza decimales y NaN', () => {
    expect(() => sum([1000, 0.5])).toThrow();
    expect(() => sum([NaN])).toThrow();
  });

  it('rechaza un total fuera del rango seguro', () => {
    expect(() => sum([Number.MAX_SAFE_INTEGER, 1])).toThrow();
  });
});
