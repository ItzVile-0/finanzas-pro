// Avisos locales en el teléfono (expo-notifications, sin servidor ni push). Qué avisar y cuándo lo decide
// src/domain/notifications.ts; aquí se lee la base, se pide el permiso y se programa.
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type * as NotificationsModule from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { todayLocal } from '@/domain/dates';
import { NOTIFY_KINDS, notificationTarget, planNotifications } from '@/domain/notifications';

import { loadLedger } from './ledger';
import { loadSettings } from './settings';

const CHANNEL_ID = 'recordatorios';
// El aviso de prueba sobrevive a la reprogramación (se puede salir de la app mientras llega).
const TEST_ID = 'prueba';

type Lib = typeof NotificationsModule;
let lib: Lib | null | undefined; // undefined = aún no se intentó cargar

/**
 * La librería, cargada la primera vez que hace falta; null en Expo Go (SDK 57 no trae su módulo nativo e importarla
 * rompe toda la app) o si no carga. Nunca se importa al arrancar: así la app funciona completa sin ella.
 */
function notifications(): Lib | null {
  if (lib !== undefined) return lib;
  lib = null;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return lib;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const N = require('expo-notifications') as Lib;
    // Con la app abierta el aviso también se muestra (si no, Android lo descarta en silencio).
    N.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
    lib = N;
  } catch (e) {
    console.warn(`[avisos] notificaciones no disponibles: ${e instanceof Error ? e.message : String(e)}`);
  }
  return lib;
}

/** false en Expo Go (solo funcionan en la app instalada) o si la librería no cargó. */
export const notificationsAvailable = () => notifications() !== null;

async function ensureChannel(N: Lib) {
  if (Platform.OS !== 'android') return;
  await N.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Recordatorios',
    description: 'Pagos, registro diario, copia de seguridad y resumen semanal',
    importance: N.AndroidImportance.DEFAULT,
  });
}

export async function hasNotificationPermission(): Promise<boolean> {
  const N = notifications();
  return N ? (await N.getPermissionsAsync()).granted : false;
}

/** Pide el permiso (Android 13+ muestra el diálogo del sistema). true si quedó concedido; false sin la librería. */
export async function requestNotificationPermission(): Promise<boolean> {
  const N = notifications();
  if (!N) return false;
  await ensureChannel(N); // en Android 13+ el diálogo solo sale si ya hay un canal
  if ((await N.getPermissionsAsync()).granted) return true;
  return (await N.requestPermissionsAsync()).granted;
}

/** Aviso de prueba en unos segundos (Ajustes → Notificaciones), para ver cómo se ven. */
export async function sendTestNotification(): Promise<void> {
  const N = notifications();
  if (!N) return;
  await N.scheduleNotificationAsync({
    identifier: TEST_ID,
    content: { title: 'Aviso de prueba', body: 'Así se verán los avisos de Finanzas Pro.' },
    trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL_ID },
  });
}

/**
 * Pantalla del aviso que el usuario tocó: con la app abierta o en segundo plano (escucha) y también si el toque la
 * abrió desde cerrada (último toque guardado). Cada toque se abre una sola vez. Devuelve cómo dejar de escuchar.
 */
export function openTappedNotifications(db: SQLiteDatabase, open: (url: string) => void): () => void {
  const N = notifications();
  if (!N) return () => {};
  const handle = async (response: NotificationsModule.NotificationResponse | null) => {
    if (!response || response.actionIdentifier !== N.DEFAULT_ACTION_IDENTIFIER) return;
    try {
      await N.clearLastNotificationResponseAsync(); // que no se vuelva a abrir al reiniciar la app
      const ids = new Set((await db.getAllAsync<{ id: string }>('SELECT id FROM recurring_payments')).map((r) => r.id));
      open(notificationTarget(response.notification.request.content.data?.url, (id) => ids.has(id)));
    } catch (e) {
      console.warn(`[avisos] no se pudo abrir el aviso: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  N.getLastNotificationResponseAsync()
    .then(handle)
    .catch(() => {});
  const sub = N.addNotificationResponseReceivedListener((r) => void handle(r));
  return () => sub.remove();
}

const localDate = (date: string, time: string) =>
  new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8)), Number(time.slice(0, 2)), Number(time.slice(3)));

// Una reprogramación a la vez: si llegan varias seguidas (salir de la app justo después de pagar), la última gana.
let queue: Promise<void> = Promise.resolve();

/**
 * Cancela todo lo programado y vuelve a programar con los datos de ahora. Nunca pide el permiso (eso solo pasa al
 * encender el primer aviso) y nunca lanza: un fallo deja un aviso en la consola, los datos no se tocan. Sin la
 * librería (Expo Go) no hace nada.
 */
export function rescheduleNotifications(db: SQLiteDatabase): Promise<void> {
  const N = notifications();
  if (!N) return queue;
  queue = queue.then(async () => {
    try {
      const [settings, ledger] = await Promise.all([loadSettings(db), loadLedger(db)]);
      for (const n of await N.getAllScheduledNotificationsAsync()) {
        if (n.identifier !== TEST_ID) await N.cancelScheduledNotificationAsync(n.identifier);
      }
      const prefs = settings.notifications;
      if (!NOTIFY_KINDS.some((k) => prefs[k].on) || !(await N.getPermissionsAsync()).granted) return;
      await ensureChannel(N);
      const now = new Date();
      const planned = planNotifications({
        prefs,
        today: todayLocal(now),
        now: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        recurring: ledger.recurring,
        transactions: ledger.transactions,
        lastBackupAt: settings.lastBackupAt,
      });
      for (const p of planned) {
        const [hour, minute] = p.time.split(':').map(Number);
        await N.scheduleNotificationAsync({
          identifier: p.id,
          content: { title: p.title, body: p.body, data: { url: p.url } },
          trigger:
            'repeat' in p
              ? { type: N.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL_ID }
              : { type: N.SchedulableTriggerInputTypes.DATE, date: localDate(p.date, p.time), channelId: CHANNEL_ID },
        });
      }
    } catch (e) {
      console.warn(`[avisos] no se pudieron programar: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
  return queue;
}
