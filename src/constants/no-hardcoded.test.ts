// Guardián: pantallas y componentes no escriben tamaños, fuentes ni colores a mano; todo sale de los
// tokens (src/constants/tokens.ts vía useTokens/makeStyles) y de la paleta (colors.ts vía useTheme).
type Dirent = { name: string; isDirectory(): boolean };
// Como backup.test.ts: módulos de Node con require y tipos mínimos (el proyecto no instala @types/node para la app).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readdirSync, readFileSync } = require('fs') as {
  readdirSync(dir: string, o: { withFileTypes: true }): Dirent[];
  readFileSync(file: string, enc: 'utf8'): string;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { join, relative } = require('path') as { join(...p: string[]): string; relative(from: string, to: string): string };
declare const __dirname: string;

const ROOT = join(__dirname, '..');
// Excepciones: el logo animado del arranque (medidas fijas del dibujo, se ve antes de leer los ajustes) y web (no es objetivo).
const EXEMPT = [/animated-icon/, /\.web\.tsx$/];

const RULES: [name: string, re: RegExp][] = [
  ['color hex o rgb', /['"`]#[0-9a-fA-F]{3,8}['"`]|\brgba?\(/],
  ['radio', /borderRadius:\s*\d/],
  ['borde', /borderWidth:\s*\d/],
  ['tipografía', /\b(fontSize|lineHeight|letterSpacing):\s*\d|fontFamily:\s*['"]/],
  ['tamaño de ícono', /\bsize=\{\s*\d/],
  ['medida por defecto', /\b(size|thickness|height|width)\s*=\s*\d/],
  ['espaciado', /\b(padding|margin|gap)\w*:\s*-?\d/],
  ['medida', /\b(min|max)?(width|height|Width|Height):\s*[1-9]/],
  ['hitSlop', /hitSlop=\{\s*\d/],
  ['constante de tamaño', /\b(Spacing|Typography|FontFamily|MaxContentWidth)\b/],
];

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? files(p) : /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

it('ninguna pantalla ni componente tiene tamaños, fuentes ni colores escritos a mano', () => {
  const found: string[] = [];
  for (const file of [...files(join(ROOT, 'app')), ...files(join(ROOT, 'components'))]) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    if (EXEMPT.some((re) => re.test(rel))) continue;
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line) || /shadow|elevation/.test(line)) return; // comentarios y sombras
        for (const [name, re] of RULES) if (re.test(line)) found.push(`${rel}:${i + 1} (${name}): ${line.trim()}`);
      });
  }
  expect(found).toEqual([]);
});
