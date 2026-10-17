import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { motionDuration } from '@/domain/motion';
import { useMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles } from '@/hooks/use-tokens';

/**
 * Confirmación con los colores del tema de la app (Alert.alert de Android sigue el tema del sistema).
 * Tocar fuera o el botón Atrás = Cancelar. Sin animación si el sistema pide reducir movimiento.
 * `otherLabel`/`onOther`: tercera opción sin relleno (p. ej. "Descartar").
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  destructive,
  otherLabel,
  onOther,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
  otherLabel?: string;
  onOther?: () => void;
}) {
  const styles = useStyles();
  const theme = useTheme();
  // Completas: aparece y crece; Suaves: solo aparece, más rápido; Desactivadas: nada.
  const motion = useMotion();
  const confirmColor = destructive ? theme.expense : theme.primary;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onCancel}>
      <Animated.View entering={motion === 'off' ? undefined : FadeIn.duration(motionDuration(motion, 150))} style={[styles.backdrop, { backgroundColor: theme.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Cancelar" accessibilityRole="button" />
        <Animated.View
          entering={motion === 'full' ? ZoomIn.duration(180) : motion === 'soft' ? FadeIn.duration(motionDuration(motion, 180)) : undefined}
          style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
          accessibilityViewIsModal
          accessibilityRole="alert">
          <ThemedText type="subtitle" accessibilityRole="header">{title}</ThemedText>
          <ThemedText themeColor="textSecondary">{message}</ThemedText>
          <View style={styles.buttons}>
            <PressableScale onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancelar" style={styles.button}>
              <ThemedText type="smallBold">Cancelar</ThemedText>
            </PressableScale>
            {otherLabel && onOther ? (
              <PressableScale onPress={onOther} accessibilityRole="button" accessibilityLabel={otherLabel} style={styles.button}>
                <ThemedText type="smallBold">{otherLabel}</ThemedText>
              </PressableScale>
            ) : null}
            <PressableScale
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              style={[styles.button, { backgroundColor: confirmColor }]}>
              <ThemedText type="smallBold" style={{ color: destructive ? theme.background : theme.onPrimary }}>{confirmLabel}</ThemedText>
            </PressableScale>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const useStyles = makeStyles((t) => ({
  backdrop: { flex: 1, justifyContent: 'center', padding: t.space.four },
  card: { borderRadius: t.radius.card, borderWidth: StyleSheet.hairlineWidth, padding: t.space.four, gap: t.space.three, maxWidth: t.size.dialog, width: '100%', alignSelf: 'center' },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: t.space.two, marginTop: t.space.two },
  button: { borderRadius: t.radius.field, paddingVertical: t.space.two + t.space.half, paddingHorizontal: t.space.three, minHeight: t.size.touch, justifyContent: 'center' },
}));
