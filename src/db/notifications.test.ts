// Si expo-notifications no está (Expo Go, SDK 57: "Cannot find native module"), el módulo carga y nada falla.
import type { SQLiteDatabase } from 'expo-sqlite';

jest.mock('expo-notifications', () => {
  throw new Error("Cannot find native module 'ExpoTopicSubscriptionModule'");
});

type Mod = typeof import('./notifications');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const load = () => require('./notifications') as Mod;

// Una base que falla si alguien la usa: sin la librería no debe leerse nada.
const db = new Proxy({}, { get: () => () => Promise.reject(new Error('no debía usarse la base')) }) as unknown as SQLiteDatabase;

it('sin la librería: el módulo carga, todo responde sin lanzar y nada se programa', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const n = load();
  expect(n.notificationsAvailable()).toBe(false);
  await expect(n.rescheduleNotifications(db)).resolves.toBeUndefined();
  await expect(n.hasNotificationPermission()).resolves.toBe(false);
  await expect(n.requestNotificationPermission()).resolves.toBe(false);
  await expect(n.sendTestNotification()).resolves.toBeUndefined();
  const open = jest.fn();
  const stop = n.openTappedNotifications(db, open);
  expect(() => stop()).not.toThrow();
  expect(open).not.toHaveBeenCalled();
  warn.mockRestore();
});

it('en Expo Go ni siquiera intenta cargar la librería', async () => {
  jest.resetModules();
  jest.doMock('expo-constants', () => ({ __esModule: true, default: { executionEnvironment: 'storeClient' }, ExecutionEnvironment: { StoreClient: 'storeClient' } }));
  const required = jest.fn();
  jest.doMock('expo-notifications', () => {
    required();
    return {};
  });
  const n = load();
  expect(n.notificationsAvailable()).toBe(false);
  await expect(n.rescheduleNotifications(db)).resolves.toBeUndefined();
  expect(required).not.toHaveBeenCalled();
});
