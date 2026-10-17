// Ajustes guardados en la tabla `settings` (clave/valor TEXT). Se validan al leer: un valor inválido usa el de por defecto.
import { DEFAULT_HOME_CARDS, parseHomeCards, type HomeCard } from './home-cards';
import { DEFAULT_NOTIFICATIONS, parseNotificationPrefs, type NotificationPrefs } from './notifications';
import { DEFAULT_STORE_NAME } from './store';
import type { MovementKind } from './ledger';
import { validateCustomRange, type Period, type PeriodKey } from './periods';

export type ThemePref = 'system' | 'light' | 'dark';
/** Color de acento (tonos en src/constants/colors.ts). */
export const ACCENTS = ['gold', 'silver', 'emerald', 'copper', 'sapphire'] as const;
export type Accent = (typeof ACCENTS)[number];
/** Apariencia (tokens en src/constants/tokens.ts). */
export const FONTS = ['inter', 'manrope', 'poppins', 'dm-sans', 'nunito', 'space-grotesk', 'lora'] as const;
export type FontKey = (typeof FONTS)[number];
export const TEXT_SCALES = ['small', 'normal', 'large', 'xlarge'] as const;
export type TextScale = (typeof TEXT_SCALES)[number];
export const DENSITIES = ['compact', 'normal', 'comfortable'] as const;
export type Density = (typeof DENSITIES)[number];
export const CORNERS = ['rounded', 'soft', 'straight'] as const;
export type Corners = (typeof CORNERS)[number];
/** Animaciones: completas, suaves (solo desvanecer, más cortas) o desactivadas. "Reducir animaciones" del sistema manda. */
export const ANIMATIONS = ['full', 'soft', 'off'] as const;
export type Animations = (typeof ANIMATIONS)[number];
export const WEEK_STARTS = ['sunday', 'monday'] as const;
export type WeekStart = (typeof WEEK_STARTS)[number];
/** Nombre para el saludo del Inicio y nombre de la tienda: máximo de caracteres (no bytes). */
export const USER_NAME_MAX = 30;
export const STORE_NAME_MAX = 30;
/** Última cuenta usada por tipo de movimiento (registro rápido). `to` solo en transferencia. */
export type LastAccounts = Partial<Record<MovementKind, { from: string; to: string | null }>>;
/** lastBackupAt: instante ISO de la última copia exportada en ESTE teléfono (no viaja en la copia). lastChannel: id del canal de la última venta (se valida contra los canales activos al usarlo).
 * storeEnabled/storeName: tienda opcional (pestaña, tarjeta del Inicio). onboardingDone: la bienvenida ya se vio o se saltó (local).
 * notifications: avisos locales de este teléfono (local: no viajan en la copia). */
export type Settings = {
  theme: ThemePref;
  hideAmounts: boolean;
  period: Period;
  lastAccounts: LastAccounts;
  lastBackupAt: string | null;
  lastChannel: string | null;
  accent: Accent;
  font: FontKey;
  textScale: TextScale;
  density: Density;
  corners: Corners;
  userName: string;
  animations: Animations;
  haptics: boolean;
  weekStart: WeekStart;
  homeCards: HomeCard[];
  storeEnabled: boolean;
  storeName: string;
  onboardingDone: boolean;
  notifications: NotificationPrefs;
};
export type SettingKey = 'theme' | 'hide_amounts' | 'period' | 'last_accounts' | 'last_backup_at' | 'last_channel' | 'accent' | 'font' | 'text_scale' | 'density' | 'corners' | 'user_name' | 'animations' | 'haptics' | 'week_start' | 'home_cards' | 'store_enabled' | 'store_name' | 'onboarding_done' | 'notifications';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  hideAmounts: false,
  period: { key: 'current_month' },
  lastAccounts: {},
  lastBackupAt: null,
  lastChannel: null,
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
  storeEnabled: false,
  storeName: DEFAULT_STORE_NAME,
  onboardingDone: false,
  notifications: DEFAULT_NOTIFICATIONS,
};

/** Ajustes de apariencia (pantalla Apariencia, "Restablecer apariencia"). */
export const APPEARANCE_DEFAULTS = {
  theme: DEFAULT_SETTINGS.theme,
  accent: DEFAULT_SETTINGS.accent,
  font: DEFAULT_SETTINGS.font,
  textScale: DEFAULT_SETTINGS.textScale,
  density: DEFAULT_SETTINGS.density,
  corners: DEFAULT_SETTINGS.corners,
} satisfies Partial<Settings>;

/**
 * Nombre del saludo: sin saltos de línea ni caracteres de control, espacios seguidos en uno, sin espacios a los lados
 * y como máximo USER_NAME_MAX caracteres (cuenta letras y emojis enteros, no unidades UTF-16).
 */
export function normalizeUserName(raw: string, max = USER_NAME_MAX): string {
  const chars = Array.from(raw).map((c) => (c.charCodeAt(0) < 32 || c === '\u007F' ? ' ' : c));
  const clean = chars.join('').replace(/\s+/g, ' ').trim();
  return Array.from(clean).slice(0, max).join('').trim();
}

/** Nombre de la tienda: como el del saludo; vacío → DEFAULT_STORE_NAME. */
export const normalizeStoreName = (raw: string) => normalizeUserName(raw, STORE_NAME_MAX) || DEFAULT_STORE_NAME;

const KINDS: MovementKind[] = ['income', 'expense', 'transfer'];

/** JSON {kind: {from, to}}. Se descarta lo que no sea válido (entrada por entrada); JSON roto = {}. */
function parseLastAccounts(value: string | undefined): LastAccounts {
  if (!value) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    return {};
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const result: LastAccounts = {};
  for (const kind of KINDS) {
    const entry = (raw as Record<string, unknown>)[kind];
    if (typeof entry !== 'object' || entry === null) continue;
    const { from, to } = entry as { from?: unknown; to?: unknown };
    if (typeof from !== 'string' || !from) continue;
    if (to !== null && to !== undefined && typeof to !== 'string') continue;
    result[kind] = { from, to: typeof to === 'string' && to ? to : null };
  }
  return result;
}

const THEMES: ThemePref[] = ['system', 'light', 'dark'];
const PERIOD_KEYS: PeriodKey[] = ['current_month', 'previous_month', 'last_3_months', 'last_6_months', 'current_year'];

/** 'last_3_months' o 'custom:2026-08-01:2026-10-14'. null si no es válido (fechas imposibles, desde > hasta, hasta > hoy). */
function parsePeriod(value: string, today: string): Period | null {
  if ((PERIOD_KEYS as string[]).includes(value)) return { key: value as PeriodKey };
  const m = /^custom:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/.exec(value);
  if (!m || Object.keys(validateCustomRange(m[1], m[2], today)).length > 0) return null;
  return { key: 'custom', from: m[1], to: m[2] };
}

const oneOf = <T extends string>(list: readonly T[], v: string | undefined, fallback: T): T =>
  (list as readonly string[]).includes(v ?? '') ? (v as T) : fallback;

const parseInstant = (v: string | undefined) => (v && !Number.isNaN(new Date(v).getTime()) ? v : null);

export function parseSettings(rows: readonly { key: string; value: string }[], today: string): Settings {
  const get = (key: SettingKey) => rows.find((r) => r.key === key)?.value;
  const theme = get('theme');
  const hide = get('hide_amounts');
  return {
    theme: THEMES.includes(theme as ThemePref) ? (theme as ThemePref) : DEFAULT_SETTINGS.theme,
    hideAmounts: hide === '1' ? true : hide === '0' ? false : DEFAULT_SETTINGS.hideAmounts,
    period: parsePeriod(get('period') ?? '', today) ?? DEFAULT_SETTINGS.period,
    lastAccounts: parseLastAccounts(get('last_accounts')),
    lastBackupAt: parseInstant(get('last_backup_at')),
    lastChannel: get('last_channel') || null,
    accent: oneOf(ACCENTS, get('accent'), DEFAULT_SETTINGS.accent),
    font: oneOf(FONTS, get('font'), DEFAULT_SETTINGS.font),
    textScale: oneOf(TEXT_SCALES, get('text_scale'), DEFAULT_SETTINGS.textScale),
    density: oneOf(DENSITIES, get('density'), DEFAULT_SETTINGS.density),
    corners: oneOf(CORNERS, get('corners'), DEFAULT_SETTINGS.corners),
    userName: normalizeUserName(get('user_name') ?? ''),
    animations: oneOf(ANIMATIONS, get('animations'), DEFAULT_SETTINGS.animations),
    weekStart: oneOf(WEEK_STARTS, get('week_start'), DEFAULT_SETTINGS.weekStart),
    homeCards: parseHomeCards(get('home_cards')),
    haptics: get('haptics') === '0' ? false : get('haptics') === '1' ? true : DEFAULT_SETTINGS.haptics,
    storeEnabled: get('store_enabled') === '1',
    storeName: normalizeStoreName(get('store_name') ?? ''),
    onboardingDone: get('onboarding_done') === '1',
    notifications: parseNotificationPrefs(get('notifications')),
  };
}

/** Filas a guardar para un cambio parcial de ajustes. */
export function encodeSettings(patch: Partial<Settings>): [SettingKey, string][] {
  const rows: [SettingKey, string][] = [];
  if (patch.theme !== undefined) rows.push(['theme', patch.theme]);
  if (patch.hideAmounts !== undefined) rows.push(['hide_amounts', patch.hideAmounts ? '1' : '0']);
  if (patch.period !== undefined) {
    const p = patch.period;
    rows.push(['period', p.key === 'custom' ? `custom:${p.from}:${p.to}` : p.key]);
  }
  if (patch.lastAccounts !== undefined) rows.push(['last_accounts', JSON.stringify(patch.lastAccounts)]);
  if (patch.lastBackupAt) rows.push(['last_backup_at', patch.lastBackupAt]);
  if (patch.lastChannel) rows.push(['last_channel', patch.lastChannel]);
  if (patch.accent) rows.push(['accent', patch.accent]);
  if (patch.font) rows.push(['font', patch.font]);
  if (patch.textScale) rows.push(['text_scale', patch.textScale]);
  if (patch.density) rows.push(['density', patch.density]);
  if (patch.corners) rows.push(['corners', patch.corners]);
  if (patch.animations) rows.push(['animations', patch.animations]);
  if (patch.weekStart) rows.push(['week_start', patch.weekStart]);
  if (patch.homeCards) rows.push(['home_cards', JSON.stringify(patch.homeCards)]);
  if (patch.haptics !== undefined) rows.push(['haptics', patch.haptics ? '1' : '0']);
  if (patch.userName !== undefined) rows.push(['user_name', normalizeUserName(patch.userName)]);
  if (patch.storeEnabled !== undefined) rows.push(['store_enabled', patch.storeEnabled ? '1' : '0']);
  if (patch.storeName !== undefined) rows.push(['store_name', normalizeStoreName(patch.storeName)]);
  if (patch.onboardingDone !== undefined) rows.push(['onboarding_done', patch.onboardingDone ? '1' : '0']);
  if (patch.notifications) rows.push(['notifications', JSON.stringify(patch.notifications)]);
  return rows;
}
