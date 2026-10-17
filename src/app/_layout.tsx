import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider, type ErrorBoundaryProps, type Href } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { AppState, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay, markStartupFailed, markStartupStep } from '@/components/animated-icon';
import { UndoProvider } from '@/components/undo-toast';
import { Colors } from '@/constants/theme';
import { FONT_TIMEOUT_MS, fontMap } from '@/constants/font-files';
import { DEFAULT_TOKENS } from '@/constants/tokens';
import { migrate } from '@/db/migrations';
import { openTappedNotifications, rescheduleNotifications } from '@/db/notifications';
import { loadSettings } from '@/db/settings';
import { useMotion } from '@/hooks/use-motion';
import { applyAppearance } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { useTokens } from '@/hooks/use-tokens';

SplashScreen.preventAutoHideAsync();

// Inter siempre: es la fuente por defecto y el respaldo si la elegida no carga.
const INTER = fontMap('inter');

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Migraciones y luego el tema y la apariencia guardados, antes de mostrar cualquier pantalla (sin destello del tema
 * equivocado). No espera a ninguna fuente: la elegida llega en segundo plano (applyAppearance). Cada paso se marca
 * para que, si algo se demora, la pantalla de arranque diga cuál.
 */
async function init(db: SQLiteDatabase) {
  markStartupStep('dbOpen');
  try {
    await migrate(db);
  } catch (e) {
    markStartupFailed(`No se pudo preparar la base de datos: ${errorText(e)}`);
    throw e; // SQLiteProvider no muestra la app: los datos no se tocan
  }
  markStartupStep('migrations');
  try {
    applyAppearance(await loadSettings(db));
  } catch (e) {
    // Sin ajustes legibles se sigue con el tema del sistema; Ajustes muestra el error al abrirse.
    console.warn(`[arranque] ajustes: ${errorText(e)}`);
  }
  markStartupStep('settings');
}

export default function RootLayout() {
  const t = useTokens();
  const [fontsLoaded, fontError] = useFonts(INTER);
  const isDark = useColorScheme() === 'dark';
  const base = isDark ? DarkTheme : DefaultTheme;
  const c = useTheme();
  // Transiciones: Completas desliza (los formularios suben desde abajo), Suaves solo desvanece, Desactivadas ninguna.
  const motion = useMotion();
  const push = motion === 'off' ? 'none' : motion === 'soft' ? 'fade' : 'slide_from_right';
  const modal = motion === 'full' ? 'slide_from_bottom' : push;
  // Colores propios en la navegación para evitar el destello del fondo por defecto al cambiar de pestaña.
  const theme = {
    ...base,
    colors: { ...base.colors, background: c.background, card: c.backgroundElement, text: c.text, border: c.border, primary: c.primaryText },
  };

  // Primero Inter (como antes de la revisión final, el orden verificado) y después la base. Si Inter falla o no llega en
  // FONT_TIMEOUT_MS (túnel lento), se sigue con la fuente del sistema: el arranque nunca queda esperando.
  const [fontsGaveUp, setFontsGaveUp] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFontsGaveUp(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);
  const fontsReady = fontsLoaded || !!fontError || fontsGaveUp;
  useEffect(() => {
    if (!fontsReady) return;
    if (!fontsLoaded) console.warn(`[arranque] Inter no cargó (${fontError ? fontError.message : `más de ${FONT_TIMEOUT_MS / 1000} s`}); se sigue con la fuente del sistema.`);
    markStartupStep('fonts');
  }, [fontsReady, fontsLoaded, fontError]);

  return (
    // Raíz de gestos (arrastre de la hoja inferior).
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider value={theme}>
        {fontsReady ? (
          // La app solo se muestra cuando las migraciones terminaron. Si fallan, init ya dejó el error a la vista (abajo).
          <SQLiteProvider databaseName="finanzas.db" onInit={init} onError={() => {}}>
            <Shown />
            {/* Aviso "Deshacer" encima de todas las pantallas (sigue visible al cerrar el formulario). */}
            <UndoProvider>
              <Stack screenOptions={{ headerTitleStyle: { fontFamily: t.font.semibold }, headerShadowVisible: false, animation: push }}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="bienvenida" options={{ title: 'Finanzas Pro', headerBackVisible: false, gestureEnabled: false }} />
                <Stack.Screen name="tienda-ajustes" options={{ title: 'Tienda' }} />
                <Stack.Screen name="notificaciones" options={{ title: 'Notificaciones' }} />
                <Stack.Screen name="cuenta-nueva" options={{ title: 'Nueva cuenta', presentation: 'modal', animation: modal }} />
                <Stack.Screen name="movimiento-nuevo" options={{ title: 'Nuevo movimiento', presentation: 'modal', animation: modal }} />
                <Stack.Screen name="cuentas" options={{ title: 'Cuentas' }} />
                <Stack.Screen name="categorias" options={{ title: 'Categorías' }} />
                <Stack.Screen name="categoria" options={{ title: 'Nueva categoría', presentation: 'modal', animation: modal }} />
                <Stack.Screen name="presupuestos" options={{ title: 'Presupuestos' }} />
                <Stack.Screen name="presupuesto" options={{ title: 'Nuevo presupuesto', presentation: 'modal', animation: modal }} />
                <Stack.Screen name="recurrentes" options={{ title: 'Pagos recurrentes' }} />
                <Stack.Screen name="recurrente" options={{ title: 'Nuevo pago recurrente', presentation: 'modal', animation: modal }} />
                <Stack.Screen name="respaldo" options={{ title: 'Copia de seguridad' }} />
                <Stack.Screen name="apariencia" options={{ title: 'Apariencia' }} />
                <Stack.Screen name="inicio-tarjetas" options={{ title: 'Tarjetas del Inicio' }} />
                <Stack.Screen name="tienda-registro" options={{ title: 'Nueva inversión', presentation: 'modal', animation: modal }} />
                <Stack.Screen name="tienda-registros" options={{ title: 'Registros' }} />
              </Stack>
            </UndoProvider>
            {/* "auto" sigue el tema de la app (Appearance), no solo el del sistema. */}
            <StatusBar style="auto" />
          </SQLiteProvider>
        ) : null}
        {/* Encima de todo; se quita al estar lista la app, o muestra qué paso falta si se demora. */}
        <AnimatedSplashOverlay />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

/**
 * SQLiteProvider solo dibuja a sus hijos con la base lista e init terminado: entonces la app ya se puede mostrar.
 * Los avisos locales se reprograman al abrir y al salir de la app (los datos solo cambian dentro de ella); tocar uno
 * abre su pantalla, también si abrió la app desde cerrada.
 */
function Shown() {
  const db = useSQLiteContext();
  useEffect(() => {
    markStartupStep('ready');
    void rescheduleNotifications(db);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') void rescheduleNotifications(db);
    });
    const stopTaps = openTappedNotifications(db, (url) => router.push(url as Href));
    return () => {
      sub.remove();
      stopTaps();
    };
  }, [db]);
  return null;
}

/**
 * Si algo falla al dibujar la app, se ve el error (no una pantalla en blanco) con "Reintentar". expo-router lo usa
 * en lugar del layout; los datos no se tocan.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
  }, []);
  return (
    <View style={styles.error} accessibilityRole="alert">
      <Text style={styles.errorTitle}>La app encontró un error</Text>
      <Text style={styles.errorText}>{error.message}</Text>
      <Text style={styles.errorText}>Tus datos no se modificaron. Toca Reintentar; si vuelve a pasar, comparte una captura de esta pantalla.</Text>
      <Pressable onPress={retry} accessibilityRole="button" style={styles.errorButton}>
        <Text style={styles.errorButtonText}>Reintentar</Text>
      </Pressable>
    </View>
  );
}

// La pantalla de error usa los tokens por defecto y Text simple: debe dibujarse aunque falle lo demás.
const T = DEFAULT_TOKENS;
const styles = StyleSheet.create({
  root: { flex: 1 },
  error: { flex: 1, justifyContent: 'center', padding: T.space.four, gap: T.space.three, backgroundColor: Colors.dark.background },
  errorTitle: { color: Colors.dark.text, fontSize: T.type.subtitle.fontSize },
  errorText: { color: Colors.dark.textSecondary, fontSize: T.type.small.fontSize },
  errorButton: {
    alignSelf: 'flex-start',
    minHeight: T.size.touch,
    justifyContent: 'center',
    paddingHorizontal: T.space.three,
    borderRadius: T.radius.field,
    borderWidth: T.border.thin,
    borderColor: Colors.dark.primaryText,
  },
  errorButtonText: { color: Colors.dark.primaryText, fontSize: T.type.default.fontSize },
});
