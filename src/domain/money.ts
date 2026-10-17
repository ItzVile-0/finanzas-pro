// Dinero en pesos enteros. Nunca se redondea en silencio.

const copFormat = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function assertPesos(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Importe inválido (se esperan pesos enteros): ${value}`);
  }
}

export function formatCOP(value: number): string {
  assertPesos(value);
  return copFormat.format(value);
}

/**
 * Texto del usuario → pesos enteros. Acepta "1500000", "1.500.000" y "$ 1.500.000".
 * Lanza Error con un mensaje para mostrar junto al campo. `allowZero` para saldos iniciales.
 */
export function parseCOP(text: string, { allowZero = false } = {}): number {
  const t = text.replace(/[\s ]/g, '').replace(/^\$/, '');
  if (t === '') throw new Error('Escribe un valor.');
  if (t.startsWith('-')) throw new Error('No se permiten valores negativos.');
  if (/,|\.\d{1,2}$/.test(t)) throw new Error('Sin decimales: escribe pesos enteros, por ejemplo 1.500.000.');
  if (!/^(\d{1,3}(\.\d{3})+|\d+)$/.test(t)) throw new Error('Solo números, por ejemplo 1.500.000.');
  const value = Number(t.replace(/\./g, ''));
  if (!Number.isSafeInteger(value)) throw new Error('El valor es demasiado grande.');
  if (value === 0 && !allowZero) throw new Error('Debe ser mayor que 0.');
  return value;
}

/**
 * Formato en vivo de un campo de pesos: "3000000" → "3.000.000". Solo agrupa dígitos; nunca cambia el valor.
 * Si el texto trae algo que no es dígito/punto/$/espacio (p. ej. "1500,50"), o un pegado que termina en
 * ".5"/".50" (decimal), lo deja igual para que parseCOP muestre el error en vez de leer otro número.
 * @param prev texto anterior del campo: escribir o borrar cambia 1 dígito; un pegado cambia varios.
 */
export function formatCOPInput(next: string, prev = ''): string {
  if (/[^\d.\s $]/.test(next)) return next;
  const digits = next.replace(/\D/g, '');
  const prevDigits = prev.replace(/\D/g, '');
  if (Math.abs(digits.length - prevDigits.length) > 1 && /\.\d{1,2}\s*$/.test(next)) return next;
  if (digits === '') return '';
  return digits.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function sum(values: readonly number[]): number {
  let total = 0;
  for (const v of values) {
    assertPesos(v);
    total += v;
  }
  assertPesos(total);
  return total;
}
