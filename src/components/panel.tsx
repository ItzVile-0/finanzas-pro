// Piezas compartidas por el Inicio y la tienda: misma entrada animada, mismo contenedor y mismas cifras.
import { SymbolView } from 'expo-symbols';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { IconName } from '@/components/icon-circle';
import { ThemedText } from '@/components/themed-text';
import { UndoHost } from '@/components/undo-toast';
import { motionDuration } from '@/domain/motion';
import { useMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles, useTokens } from '@/hooks/use-tokens';


/** Tarjeta con entrada escalonada (Completas), solo desvanecer (Suaves) o nada (Desactivadas o "reducir animaciones"). */
export function Enter({ index, children }: { index: number; children: ReactNode }) {
  const motion = useMotion();
  const entering = motion === 'full' ? FadeInDown.delay(index * 70).duration(320) : motion === 'soft' ? FadeIn.duration(motionDuration(motion, 320)) : undefined;
  return <Animated.View entering={entering}>{children}</Animated.View>;
}

/** Contenedor desplazable. padBottom deja sitio para que el botón flotante no tape la última fila; onScroll: useHideOnScroll. */
export function Screen({ children, padBottom, onScroll }: { children?: ReactNode; padBottom?: boolean; onScroll?: ComponentProps<typeof Animated.ScrollView>['onScroll'] }) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <Animated.ScrollView contentContainerStyle={[styles.content, padBottom && styles.fabClearance]} onScroll={onScroll} scrollEventThrottle={16}>
        {/* Sin contenido = los datos aún se leen: se dice, nunca una pantalla vacía. */}
        {children ?? (
          <View style={styles.loading} accessibilityLiveRegion="polite">
            <ActivityIndicator color={theme.primaryText} />
            <ThemedText type="small" themeColor="textSecondary">Cargando…</ThemedText>
          </View>
        )}
      </Animated.ScrollView>
      <UndoHost inTabs />
    </SafeAreaView>
  );
}

/** Cifra con flecha: "↑ Ingresos $ 1.000". */
export function Figure({ icon, color, label, value }: { icon: IconName; color: string; label: string; value: string }) {
  const t = useTokens();
  const styles = useStyles();
  return (
    <View style={[styles.flex, styles.row]}>
      <SymbolView name={icon} size={t.icon.md} tintColor={color} />
      <View>
        <ThemedText type="caption" themeColor="textSecondary">{label}</ThemedText>
        <ThemedText type="smallBold" style={[styles.amount, { color }]}>{value}</ThemedText>
      </View>
    </View>
  );
}

/** Línea de desglose: ícono opcional, etiqueta y valor a la derecha. */
export function Line({ label, value, color, icon }: { label: string; value: string; color?: string; icon?: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      {icon}
      <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>{label}</ThemedText>
      <ThemedText type="smallBold" style={[styles.amount, color ? { color } : null]}>{value}</ThemedText>
    </View>
  );
}

export const usePanelStyles = makeStyles((t) => ({
  card: { padding: t.space.three, borderRadius: t.radius.card, borderWidth: StyleSheet.hairlineWidth, gap: t.space.three },
  list: { paddingHorizontal: t.space.three, paddingVertical: t.space.one, borderRadius: t.radius.card, borderWidth: StyleSheet.hairlineWidth },
  amount: { fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.two },
  flex: { flex: 1 },
  barBlock: { gap: t.space.one },
  bar: { height: t.size.bar, borderRadius: t.radius.bar, overflow: 'hidden', flexDirection: 'row' },
  item: { paddingVertical: t.space.two + t.space.half, minHeight: t.size.touch, justifyContent: 'center' },
  sectionTitle: { marginBottom: t.space.two },
}));

const useStyles = makeStyles((t) => ({
  flex: { flex: 1 },
  // Sin inset inferior de la barra: NativeTabs ya deja el contenido por encima.
  content: { padding: t.space.three, gap: t.space.three, width: '100%', maxWidth: t.size.maxContent, alignSelf: 'center' },
  // Alto del botón + su margen inferior + aire: el último valor nunca queda debajo del +.
  loading: { alignItems: 'center', gap: t.space.two, paddingVertical: t.space.six },
  fabClearance: { paddingBottom: t.size.fab + t.space.three + t.space.six },
  amount: { fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.two },
}));
