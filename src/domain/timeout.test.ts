import { TimeoutError, withTimeout } from './timeout';

describe('withTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('devuelve el resultado si llega a tiempo', async () => {
    const p = withTimeout(Promise.resolve(42), 1000, 'prueba');
    await expect(p).resolves.toBe(42);
  });

  it('rechaza con TimeoutError si la promesa nunca termina', async () => {
    const p = withTimeout(new Promise(() => {}), 1000, 'fuente');
    jest.advanceTimersByTime(1000);
    await expect(p).rejects.toBeInstanceOf(TimeoutError);
  });

  it('un error propio de la promesa pasa tal cual (no se confunde con el tiempo)', async () => {
    const p = withTimeout(Promise.reject(new Error('archivo dañado')), 1000, 'fuente');
    await expect(p).rejects.toThrow('archivo dañado');
  });
});
