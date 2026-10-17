import { DEFAULT_HOME_CARDS } from './home-cards';
import { DEFAULT_NOTIFICATIONS } from './notifications';
import { DEFAULT_SETTINGS, encodeSettings, normalizeUserName, parseSettings, USER_NAME_MAX, type Settings } from './settings';

const today = '2026-10-14';
const rows = (r: Record<string, string>) => Object.entries(r).map(([key, value]) => ({ key, value }));

describe('parseSettings', () => {
  it('sin filas → valores por defecto', () => {
    expect(parseSettings([], today)).toEqual(DEFAULT_SETTINGS);
  });

  it('lee valores válidos', () => {
    expect(parseSettings(rows({ theme: 'dark', hide_amounts: '1', period: 'last_3_months' }), today)).toEqual({
      theme: 'dark',
      hideAmounts: true,
      period: { key: 'last_3_months' },
      lastAccounts: {},
      lastBackupAt: null,
      lastChannel: null,
      storeEnabled: false,
      storeName: 'Mi tienda',
      onboardingDone: false,
      notifications: DEFAULT_NOTIFICATIONS,
      accent: 'gold',
      font: 'inter',
      textScale: 'normal',
      density: 'normal',
      corners: 'rounded',
      userName: '',
      animations: 'full',
      haptics: true,
      weekStart: 'sunday',
      homeCards: DEFAULT_HOME_CARDS,
    });
    expect(parseSettings(rows({ period: 'custom:2026-08-01:2026-10-14' }), today).period).toEqual({
      key: 'custom', from: '2026-08-01', to: '2026-10-14',
    });
  });

  it('valores inválidos → por defecto, sin fallar', () => {
    const s = parseSettings(rows({ theme: 'oscuro', hide_amounts: 'true', period: 'semana', last_backup_at: 'ayer', last_channel: 'otro', accent: 'rosa', font: 'comic', text_scale: 'enorme', density: '2', corners: 'circular', animations: 'rapidas', haptics: 'si', week_start: 'martes', home_cards: '[' }), today);
    // El canal guardado solo se valida al usarlo, contra los canales activos (son datos del usuario).
    expect(s).toEqual({ ...DEFAULT_SETTINGS, lastChannel: 'otro' });
    for (const period of ['custom:2026-02-30:2026-03-01', 'custom:2026-10-10:2026-10-01', 'custom:2026-10-01:2026-10-15', 'custom:', '']) {
      expect(parseSettings(rows({ period }), today).period).toEqual(DEFAULT_SETTINGS.period);
    }
  });
});

describe('encodeSettings', () => {
  it('solo las claves cambiadas, y se vuelven a leer igual', () => {
    expect(encodeSettings({ hideAmounts: false })).toEqual([['hide_amounts', '0']]);
    const all: Settings = {
      theme: 'light',
      hideAmounts: true,
      period: { key: 'custom', from: '2026-01-01', to: '2026-02-01' },
      lastAccounts: { expense: { from: 'banco', to: null }, transfer: { from: 'banco', to: 'ahorros' } },
      lastBackupAt: '2026-10-16T15:00:00.000Z',
      lastChannel: 'marketplace',
      accent: 'copper',
      font: 'space-grotesk',
      textScale: 'xlarge',
      density: 'compact',
      corners: 'straight',
      userName: '[PRUEBA] Ana',
      animations: 'soft',
      haptics: false,
      weekStart: 'monday',
      homeCards: [{ id: 'recent', visible: true }, { id: 'store', visible: false }, { id: 'budgets', visible: true }, { id: 'upcoming', visible: true }, { id: 'income', visible: true }, { id: 'accounts', visible: true }],
      storeEnabled: true,
      storeName: '[PRUEBA] Tienda',
      onboardingDone: true,
      notifications: { ...DEFAULT_NOTIFICATIONS, daily: { on: true, time: '21:15' }, showAmounts: true },
    };
    const encoded = encodeSettings(all).map(([key, value]) => ({ key, value }));
    expect(parseSettings(encoded, today)).toEqual(all);
  });
});

describe('last_accounts (registro rápido)', () => {
  const read = (value: string) => parseSettings(rows({ last_accounts: value }), today).lastAccounts;

  it('lee las entradas válidas por tipo', () => {
    expect(read('{"expense":{"from":"banco","to":null},"transfer":{"from":"banco","to":"ahorros"}}')).toEqual({
      expense: { from: 'banco', to: null },
      transfer: { from: 'banco', to: 'ahorros' },
    });
  });

  it('descarta entradas inválidas una por una, sin fallar', () => {
    expect(
      // owner_withdrawal ya no es un tipo de movimiento (migración 5): se descarta como "venta".
      read('{"expense":{"from":""},"income":{"from":"caja"},"transfer":{"from":"a","to":7},"venta":{"from":"x"},"owner_withdrawal":{"from":"caja"}}'),
    ).toEqual({ income: { from: 'caja', to: null } });
  });

  it('JSON roto, lista o texto → {}', () => {
    for (const value of ['{', '[]', '"banco"', 'null', '']) expect(read(value)).toEqual({});
  });
});

describe('user_name (saludo del Inicio)', () => {
  it('recorta espacios, junta los seguidos y quita saltos de línea', () => {
    expect(normalizeUserName('  [PRUEBA]   Ana \n María\t ')).toBe('[PRUEBA] Ana María');
    expect(normalizeUserName('   ')).toBe('');
  });

  it(`máximo ${USER_NAME_MAX} caracteres, contando emojis enteros`, () => {
    expect(normalizeUserName('a'.repeat(40))).toHaveLength(USER_NAME_MAX);
    const emoji = normalizeUserName('😀'.repeat(31));
    expect(Array.from(emoji)).toHaveLength(USER_NAME_MAX); // sin medio emoji al final
  });

  it('se valida al leer y al guardar', () => {
    expect(parseSettings(rows({ user_name: `  ${'b'.repeat(35)}  ` }), today).userName).toBe('b'.repeat(USER_NAME_MAX));
    expect(encodeSettings({ userName: '  Ana  ' })).toEqual([['user_name', 'Ana']]);
    expect(encodeSettings({ userName: '' })).toEqual([['user_name', '']]);
  });
});
