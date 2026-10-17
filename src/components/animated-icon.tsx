import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Colors } from '@/constants/theme';
import { motionDuration } from '@/domain/motion';
import { useMotion } from '@/hooks/use-motion';

const DURATION = 600;

// Pasos del arranque, en orden. Cada uno se marca al terminar; si algo se demora, la copia del splash dice cuál falta.
const STEPS = ['fonts', 'dbOpen', 'migrations', 'settings', 'ready'] as const;
type Step = (typeof STEPS)[number];
const STEP_LABEL: Record<Step, string> = {
  fonts: 'Fuente Inter',
  dbOpen: 'Abrir la base de datos',
  migrations: 'Migraciones',
  settings: 'Ajustes y tema',
  ready: 'Mostrar la app',
};
const done = new Set<Step>();
let failure: string | null = null;
let version = 0;
const listeners = new Set<() => void>();
const notify = () => {
  version += 1;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** Marca un paso del arranque como terminado ('ready' = la app ya puede mostrarse). */
export function markStartupStep(step: Step) {
  if (done.has(step)) return;
  done.add(step);
  notify();
}
/** Un paso falló: la copia del splash se queda y muestra el error de inmediato (nunca una pantalla vacía). */
export function markStartupFailed(message: string) {
  failure = message;
  notify();
}

/** Si a los SLOW_MS la app no está lista, la copia del splash muestra qué paso falta (nunca queda una pantalla muda). */
const SLOW_MS = 10_000;

const fadeOut = new Keyframe({
  0: { opacity: 1 },
  20: { opacity: 1 },
  70: { opacity: 0, easing: Easing.out(Easing.cubic) },
  100: { opacity: 0 },
});

/**
 * Copia del splash nativo (mismo fondo y moneda): oculta el nativo al dibujarse, se queda hasta que la app está lista y
 * luego se desvanece. Si tarda más de SLOW_MS, muestra el avance de cada paso en vez de dejar la pantalla quieta.
 */
export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);
  const [slow, setSlow] = useState(false);
  useSyncExternalStore(subscribe, () => version);
  const ready = done.has('ready');
  const motion = useMotion();

  useEffect(() => {
    const timer = setTimeout(() => {
      setSlow(true);
      void SplashScreen.hideAsync().catch(() => {});
      console.warn(`[arranque] más de ${SLOW_MS / 1000} s; pasos terminados: ${[...done].join(', ') || 'ninguno'}`);
    }, SLOW_MS);
    return () => clearTimeout(timer);
  }, []);

  // Sin animaciones, en cuanto está lista se quita de una vez.
  if (!visible || (ready && motion === 'off')) return null;

  // La misma moneda y tamaño que el splash nativo (app.json: splash-icon.png, imageWidth 76): el paso no se nota.
  const image = <Image style={styles.splashImage} source={require('@/assets/images/splash-icon.png')} />;

  if (ready) {
    return (
      <Animated.View
        entering={fadeOut.duration(motionDuration(motion, DURATION)).withCallback((finished) => {
          'worklet';
          if (finished) scheduleOnRN(setVisible, false);
        })}
        style={styles.splashOverlay}>
        {image}
      </Animated.View>
    );
  }
  return (
    // Al dibujarse ya tapa igual que el nativo: se puede ocultar el nativo sin parpadeo.
    <View onLayout={() => void SplashScreen.hideAsync().catch(() => {})} style={styles.splashOverlay}>
      {image}
      {slow || failure ? (
        <View style={styles.status} accessibilityLiveRegion="polite">
          <Text style={styles.statusTitle}>{failure ? 'La app no pudo abrir' : 'La app está tardando en abrir…'}</Text>
          {STEPS.map((s) => (
            <Text key={s} style={styles.statusLine}>
              {done.has(s) ? '✓' : '…'} {STEP_LABEL[s]}
            </Text>
          ))}
          {failure ? <Text style={styles.statusLine}>Error: {failure}</Text> : null}
          <Text style={styles.statusLine}>Si no avanza, cierra la app, ábrela otra vez y comparte una captura de esta pantalla.</Text>
        </View>
      ) : null}
    </View>
  );
}

// Fuera del sistema de tokens a propósito: se dibuja antes de leer los ajustes (excepción en no-hardcoded.test.ts).
const styles = StyleSheet.create({
  splashImage: {
    width: 76,
    height: 76,
  },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    // Igual al fondo del splash nativo (app.json) para que no haya salto de color.
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  status: { marginTop: 32, paddingHorizontal: 24, gap: 6, maxWidth: 420 },
  statusTitle: { color: Colors.dark.text, fontSize: 16, textAlign: 'center', marginBottom: 6 },
  statusLine: { color: Colors.dark.textSecondary, fontSize: 14 },
});
