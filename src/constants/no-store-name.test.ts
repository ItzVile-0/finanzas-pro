// Guardián (pedido del usuario, 2026-10-17): el nombre real de la tienda no queda escrito en el código; todo usa el
// nombre configurado. Única excepción: las migraciones publicadas (y su test), que guardan los datos tal como estaban.
type Dirent = { name: string; isDirectory(): boolean };
// Como no-hardcoded.test.ts: módulos de Node con require y tipos mínimos.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readdirSync, readFileSync } = require('fs') as {
  readdirSync(dir: string, o: { withFileTypes: true }): Dirent[];
  readFileSync(file: string, enc: 'utf8'): string;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { join, relative } = require('path') as { join(...p: string[]): string; relative(from: string, to: string): string };
declare const __dirname: string;

const ROOT = join(__dirname, '..');
const NAME = new RegExp(['ERO', 'SELLE'].join(''), 'i'); // en partes, para que este archivo no lo contenga
const EXEMPT = /[\\/]db[\\/]migrations(\.test)?\.ts$/;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return files(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

it('el nombre de la tienda solo aparece en las migraciones', () => {
  const found = files(ROOT).filter((f) => !EXEMPT.test(f) && NAME.test(readFileSync(f, 'utf8')));
  expect(found.map((f) => relative(ROOT, f))).toEqual([]);
});
