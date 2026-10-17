import { useIsFocused } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withTiming, ZoomIn, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from '@/components/haptics';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { motionDuration } from '@/domain/motion';
import { notifyLedgerChanged } from '@/hooks/use-ledger';
import { useMotion } from '@/hooks/use-motion';
import { useScreenReader } from '@/hooks/use-screen-reader';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles, useTokens } from '@/hooks/use-tokens';

/** `undo` devuelve null si se deshizo o el mensaje de por qué no. */
export type UndoRequest = { message: string; undo: () => Promise<string | null> };

type Toast = { message: string; undo?: () => Promise<string | null>; done?: boolean; key: number };
type UndoState = {
  request: (r: UndoRequest) => void;
  notify: (message: string) => void;
  toast: Toast | null;
  busy: boolean;
  undo: () => void;
  /** Cuánto debe subir lo que flota abajo (el botón +) para no quedar debajo del aviso: su alto + un espacio, o 0. */
  lift: SharedValue<number>;
};

const UndoContext = createContext<UndoState | null>(null);
const useUndoState = () => {
  const s = useContext(UndoContext);
  if (!s) throw new Error('UndoProvider falta en _layout.');
  return s;
};
/** Muestra el aviso "… · Deshacer" en la pantalla que quede con foco (también después de cerrar el formulario). */
export const useUndo = () => useUndoState().request;
/** Confirmación breve con un check ("Movimiento guardado") en la pantalla que quede con foco. */
export const useNotify = () => useUndoState().notify;

/** translateY para lo que flota abajo: sube por encima del aviso mientras está visible. */
export function useUndoLiftStyle() {
  const { lift } = useUndoState();
  return useAnimatedStyle(() => ({ transform: [{ translateY: -lift.get() }] }));
}

const VISIBLE_MS = 6000;
const VISIBLE_MS_SCREEN_READER = 12000; // con TalkBack hace falta más tiempo para llegar al botón
const DONE_MS = 1800;

/** Estado del aviso (uno solo para toda la app). Lo dibuja el UndoHost de la pantalla con foco. */
export function UndoProvider({ children }: { children: ReactNode }) {
  const screenReader = useScreenReader();
  const [toast, setToast] = useState<Toast | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lift = useSharedValue(0);

  const show = useCallback((next: Omit<Toast, 'key'>, ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ ...next, key: Date.now() });
    AccessibilityInfo.announceForAccessibility(next.undo ? `${next.message}. Puedes deshacerlo.` : next.message);
    timer.current = setTimeout(() => setToast(null), ms);
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const request = useCallback(
    (r: UndoRequest) => show({ message: r.message, undo: r.undo }, screenReader ? VISIBLE_MS_SCREEN_READER : VISIBLE_MS),
    [show, screenReader],
  );

  const notify = useCallback((message: string) => show({ message, done: true }, DONE_MS), [show]);

  async function undo() {
    if (!toast?.undo || busy) return;
    setBusy(true);
    try {
      const error = await toast.undo();
      if (error) show({ message: error }, VISIBLE_MS);
      else {
        notifyLedgerChanged();
        haptics.success();
        show({ message: 'Listo, se deshizo.', done: true }, 2500);
      }
    } catch (e) {
      show({ message: `No se pudo deshacer: ${e instanceof Error ? e.message : String(e)}` }, VISIBLE_MS);
    } finally {
      setBusy(false);
    }
  }

  return <UndoContext.Provider value={{ request, notify, toast, busy, undo: () => void undo(), lift }}>{children}</UndoContext.Provider>;
}

/**
 * Lugar del aviso dentro de una pantalla (va como último hijo del contenedor que llena la pantalla). Solo se dibuja en la
 * pantalla con foco. Abajo del contenido: en las pestañas, ese borde ya es el de la barra nativa (la altura real, en
 * cualquier teléfono); en las demás pantallas se suma el margen inferior del sistema (`inTabs={false}`).
 */
export function UndoHost({ inTabs }: { inTabs: boolean }) {
  const styles = useStyles();
  const theme = useTheme();
  const t = useTokens();
  const motion = useMotion();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { toast, busy, undo, lift } = useUndoState();
  const visible = focused && toast !== null;
  const duration = motionDuration(motion, 220);

  // Al irse el aviso (o la pantalla), lo que flota vuelve a su lugar.
  useEffect(() => {
    if (!visible) return;
    return () => {
      lift.set(duration ? withTiming(0, { duration }) : 0);
    };
  }, [visible, lift, duration]);

  if (!visible) return null;
  return (
    <Animated.View
      key={toast.key}
      entering={motion === 'off' ? undefined : FadeInDown.duration(duration)}
      exiting={motion === 'off' ? undefined : FadeOut.duration(motionDuration(motion, 180))}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height + t.space.two;
        lift.set(duration ? withTiming(h, { duration }) : h);
      }}
      style={[styles.wrap, { bottom: (inTabs ? 0 : insets.bottom) + t.space.three }]}>
      <View
        style={[styles.toast, { backgroundColor: theme.backgroundElement, borderColor: theme.border, shadowColor: theme.text }]}
        accessibilityLiveRegion="polite">
        {toast.done ? (
          // El check "aparece": crece con Animaciones completas, solo se desvanece con Suaves.
          <Animated.View
            entering={motion === 'full' ? ZoomIn.springify().damping(14) : motion === 'soft' ? FadeIn.duration(duration) : undefined}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden>
            <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle' }} size={t.icon.xl} tintColor={theme.income} />
          </Animated.View>
        ) : null}
        <ThemedText type="small" style={styles.message}>{toast.message}</ThemedText>
        {toast.undo ? (
          <PressableScale
            onPress={undo}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Deshacer"
            accessibilityHint="Vuelve a poner lo que acabas de eliminar"
            style={styles.button}>
            <ThemedText type="smallBold" style={{ color: theme.primaryText }}>{busy ? 'Deshaciendo…' : 'Deshacer'}</ThemedText>
          </PressableScale>
        ) : null}
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((t) => ({
  // box-none: fuera del aviso los toques llegan a la pantalla de abajo.
  wrap: { pointerEvents: 'box-none', position: 'absolute', left: t.space.three, right: t.space.three, alignItems: 'center' },
  toast: {
    width: '100%',
    maxWidth: t.size.dialog,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.two,
    paddingLeft: t.space.three,
    paddingRight: t.space.one,
    paddingVertical: t.space.one,
    minHeight: t.size.touch + t.space.two,
    borderRadius: t.radius.tile,
    borderWidth: t.border.thin,
    elevation: 6,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  message: { flex: 1 },
  button: { minHeight: t.size.touch, minWidth: t.size.touch, paddingHorizontal: t.space.three, justifyContent: 'center', alignItems: 'center' },
}));
