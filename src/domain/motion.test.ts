import { effectiveMotion, motionDuration } from './motion';

describe('movimiento', () => {
  it('"reducir animaciones" del sistema manda sobre el ajuste de la app', () => {
    expect(effectiveMotion('full', true)).toBe('off');
    expect(effectiveMotion('soft', true)).toBe('off');
    expect(effectiveMotion('full', false)).toBe('full');
    expect(effectiveMotion('soft', false)).toBe('soft');
    expect(effectiveMotion('off', false)).toBe('off');
  });

  it('duraciones: completas, más cortas en Suaves y 0 sin animaciones', () => {
    expect(motionDuration('full', 300)).toBe(300);
    expect(motionDuration('soft', 300)).toBe(180);
    expect(motionDuration('off', 300)).toBe(0);
  });
});
