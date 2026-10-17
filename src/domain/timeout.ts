// Tiempo máximo para promesas que podrían no terminar nunca (p. ej. una fuente que no llega por el túnel de Expo Go).

export class TimeoutError extends Error {}

/** La promesa, o un rechazo con TimeoutError si no termina en `ms`. No cancela la promesa original (sigue en segundo plano). */
export function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(`${what}: no terminó en ${ms / 1000} s`)), ms);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}
