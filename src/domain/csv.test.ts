import { csvCell, storeCsv, movementsCsv, type CsvMovement } from './csv';

const m = (over: Partial<CsvMovement>): CsvMovement => ({
  date: '2026-10-01',
  kind: 'expense',
  account: '[PRUEBA] Banco',
  toAccount: null,
  category: 'Transporte',
  amount: 12000,
  note: '',
  ...over,
});

describe('csvCell', () => {
  it('escapa ; comillas y saltos de línea', () => {
    expect(csvCell('simple')).toBe('simple');
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('dijo "hola"')).toBe('"dijo ""hola"""');
    expect(csvCell('línea 1\nlínea 2')).toBe('"línea 1\nlínea 2"');
  });

  it('neutraliza fórmulas de Excel', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+57 300')).toBe("'+57 300");
    expect(csvCell('-50')).toBe("'-50");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('pago 2+2')).toBe('pago 2+2');
  });
});

describe('movementsCsv', () => {
  it('BOM, encabezado, CRLF, orden por fecha, monto entero y tipos en español', () => {
    const csv = movementsCsv([
      m({ date: '2026-10-05', kind: 'transfer', toAccount: '[PRUEBA] Efectivo', category: null, amount: 200000 }),
      m({ date: '2026-10-01', kind: 'income', category: 'Nómina', amount: 3000000, note: 'quincena; octubre' }),
      m({ date: '2026-10-03', kind: 'expense', account: '[PRUEBA] Efectivo', category: 'Transporte', amount: 500000 }),
    ]);
    expect(csv).toBe(
      '﻿Fecha;Tipo;Cuenta;Cuenta destino;Categoría;Monto;Nota\r\n' +
        '2026-10-01;Ingreso;[PRUEBA] Banco;;Nómina;3000000;"quincena; octubre"\r\n' +
        '2026-10-03;Gasto;[PRUEBA] Efectivo;;Transporte;500000;\r\n' +
        '2026-10-05;Transferencia;[PRUEBA] Banco;[PRUEBA] Efectivo;;200000;\r\n',
    );
  });

  it('sin movimientos: solo el encabezado', () => {
    expect(movementsCsv([])).toBe('﻿Fecha;Tipo;Cuenta;Cuenta destino;Categoría;Monto;Nota\r\n');
  });
});

describe('storeCsv', () => {
  it('cabecera, tipo, canal, orden por fecha, BOM, CRLF y fórmulas neutralizadas', () => {
    const csv = storeCsv([
      { date: '2026-10-09', type: 'sale', channel: 'Marketplace', account: '[PRUEBA] Nequi', amount: 85000, note: '=Body; negro' },
      { date: '2026-10-02', type: 'investment', channel: null, account: '[PRUEBA] Banco', amount: 300000, note: '' },
    ]);
    expect(csv).toBe(
      '\ufeffFecha;Tipo;Canal;Cuenta;Monto;Nota\r\n' +
        '2026-10-02;Inversión;;[PRUEBA] Banco;300000;\r\n' +
        `2026-10-09;Venta;Marketplace;[PRUEBA] Nequi;85000;"'=Body; negro"\r\n`,
    );
  });
});
