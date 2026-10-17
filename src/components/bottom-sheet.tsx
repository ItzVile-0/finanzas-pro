import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { ThemedText } from '@/components/themed-text';
import { motionDuration } from '@/domain/motion';
import { useMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles, useTokens } from '@/hooks/use-tokens';

const DURATION = 220;
const CLOSE_DISTANCE = 80; // px arrastrados hacia abajo para cerrar
const CLOSE_VELOCITY = 800;

/**
 * Hoja inferior propia (sin dependencias nuevas): Modal + Reanimated + arrastre con gesture-handler.
 * Se cierra arrastrando hacia abajo, tocando el fondo o con Atrás. Con "reducir animaciones", sin animación.
 * El contenido se monta al abrir (estado nuevo cada vez) y se desmonta después de la animación de salida.
 */
export function BottomSheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const styles = useStyles();
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  // Estable: el efecto de la animación depende de ella.
  const onClosed = useCallback(() => setMounted(false), []);
  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      {/* El Modal es otra raíz en Android: los gestos necesitan su propio GestureHandlerRootView. */}
      <GestureHandlerRootView style={styles.flex}>
        {mounted ? (
          <Sheet visible={visible} onClose={onClose} onClosed={onClosed} title={title}>
            {children}
          </Sheet>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

function Sheet({
  visible,
  onClose,
  onClosed,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  onClosed: () => void;
  title: string;
  children: ReactNode;
}) {
  const styles = useStyles();
  const theme = useTheme();
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const duration = motionDuration(useMotion(), DURATION);
  const height = useSharedValue(1000); // se corrige con onLayout
  const offset = useSharedValue(1000); // 0 = abierta; height = fuera de pantalla
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      offset.set(withTiming(0, { duration }));
      backdrop.set(withTiming(1, { duration }));
    } else {
      backdrop.set(withTiming(0, { duration }));
      offset.set(
        withTiming(height.get(), { duration }, (finished) => {
          if (finished) scheduleOnRN(onClosed);
        }),
      );
    }
  }, [visible, duration, offset, backdrop, height, onClosed]);

  const drag = Gesture.Pan()
    .onUpdate((e) => {
      offset.set(Math.max(0, e.translationY));
    })
    .onEnd((e) => {
      if (e.translationY > CLOSE_DISTANCE || e.velocityY > CLOSE_VELOCITY) scheduleOnRN(onClose);
      else offset.set(withSpring(0, { damping: 20, stiffness: 300 }));
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.get() }));

  return (
    <View style={styles.flex}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }, backdropStyle]}>
        <Pressable style={styles.flex} onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar" />
      </Animated.View>
      <Animated.View
        onLayout={(e) => height.set(e.nativeEvent.layout.height)}
        style={[
          styles.sheet,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border, paddingBottom: insets.bottom + t.space.three },
          sheetStyle,
        ]}
        accessibilityViewIsModal>
        <GestureDetector gesture={drag}>
          <View style={styles.grab} accessibilityHint="Desliza hacia abajo para cerrar">
            <View style={[styles.handle, { backgroundColor: theme.track }]} />
            <ThemedText type="smallBold" accessibilityRole="header">{title}</ThemedText>
          </View>
        </GestureDetector>
        <View style={styles.body}>{children}</View>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '90%',
  },
  grab: { alignItems: 'center', gap: t.space.two, paddingTop: t.space.two, paddingBottom: t.space.three },
  handle: { width: t.size.handleWidth, height: t.size.handleHeight, borderRadius: t.radius.handle },
  body: { paddingHorizontal: t.space.three, gap: t.space.four },
}));
