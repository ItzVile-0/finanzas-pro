import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { addMonths, monthGrid, weekdayOrder } from '@/domain/calendar';
import { formatLongDate, formatMonthYear, todayLocal } from '@/domain/dates';
import { motionDuration } from '@/domain/motion';
import { useAppearance } from '@/hooks/use-appearance';
import { useMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles, useTokens } from '@/hooks/use-tokens';

const WEEKDAYS = [
  ['D', 'domingo'],
  ['L', 'lunes'],
  ['M', 'martes'],
  ['M', 'miércoles'],
  ['J', 'jueves'],
  ['V', 'viernes'],
  ['S', 'sábado'],
] as const;

const monthTitle = (ym: string) => formatMonthYear(new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1));

/**
 * Calendario propio con los colores del tema (el nativo de Android sigue el tema del sistema).
 * Días posteriores a `max` deshabilitados; hoy con borde; el elegido relleno. Tocar fuera o Atrás = Cancelar.
 */
export function CalendarModal({
  visible,
  value,
  max = todayLocal(),
  onSelect,
  onCancel,
}: {
  visible: boolean;
  value: string;
  max?: string;
  onSelect: (iso: string) => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onCancel}>
      {/* Se monta al abrir: el mes mostrado arranca siempre en la fecha elegida. */}
      {visible ? <Calendar value={value} max={max} onSelect={onSelect} onCancel={onCancel} /> : null}
    </Modal>
  );
}

function Calendar({ value, max, onSelect, onCancel }: { value: string; max: string; onSelect: (iso: string) => void; onCancel: () => void }) {
  const t = useTokens();
  const styles = useStyles();
  const theme = useTheme();
  // Completas: aparece y crece; Suaves: solo aparece, más rápido; Desactivadas: nada.
  const motion = useMotion();
  const { weekStart } = useAppearance();
  const order = weekdayOrder(weekStart);
  const today = todayLocal();
  const [month, setMonth] = useState(value.slice(0, 7));
  const canGoNext = addMonths(month, 1) <= max.slice(0, 7);

  return (
    <Animated.View entering={motion === 'off' ? undefined : FadeIn.duration(motionDuration(motion, 150))} style={[styles.backdrop, { backgroundColor: theme.overlay }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Cancelar" accessibilityRole="button" />
      <Animated.View
        entering={motion === 'full' ? ZoomIn.duration(180) : motion === 'soft' ? FadeIn.duration(motionDuration(motion, 180)) : undefined}
        style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
        accessibilityViewIsModal>
        <View style={styles.header}>
          <PressableScale onPress={() => setMonth(addMonths(month, -1))} accessibilityRole="button" accessibilityLabel="Mes anterior" style={styles.arrow}>
            <SymbolView name={{ ios: 'chevron.left', android: 'chevron_left' }} size={t.icon.nav} tintColor={theme.text} />
          </PressableScale>
          <ThemedText type="smallBold" accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.title}>
            {monthTitle(month)}
          </ThemedText>
          <PressableScale
            onPress={() => setMonth(addMonths(month, 1))}
            disabled={!canGoNext}
            accessibilityRole="button"
            accessibilityLabel="Mes siguiente"
            style={[styles.arrow, !canGoNext && styles.disabled]}>
            <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right' }} size={t.icon.nav} tintColor={theme.text} />
          </PressableScale>
        </View>

        <View style={styles.week} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {order.map((i) => WEEKDAYS[i]).map(([short, long]) => (
            <View key={long} style={styles.col}>
              <ThemedText type="caption" themeColor="textSecondary">{short}</ThemedText>
            </View>
          ))}
        </View>
        {monthGrid(month, weekStart).map((week, w) => (
          <View key={w} style={styles.week}>
            {week.map((iso, d) => {
              if (!iso) return <View key={d} style={styles.col} />;
              const future = iso > max;
              const selected = iso === value;
              const isToday = iso === today;
              return (
                // La columna es una View: PressableScale aplica `style` a una vista interior y no fijaría el ancho.
                <View key={iso} style={styles.col}>
                <PressableScale
                  onPress={() => onSelect(iso)}
                  disabled={future}
                  accessibilityRole="button"
                  accessibilityLabel={`${WEEKDAYS[order[d]][1]} ${formatLongDate(iso)}${isToday ? ', hoy' : ''}`}
                  accessibilityState={{ selected, disabled: future }}>
                  <View
                    style={[
                      styles.day,
                      selected && { backgroundColor: theme.primary },
                      isToday && !selected && { borderWidth: t.border.button, borderColor: theme.primaryText },
                      future && styles.disabled,
                    ]}>
                    <ThemedText type="small" style={{ color: selected ? theme.onPrimary : theme.text }}>
                      {Number(iso.slice(8))}
                    </ThemedText>
                  </View>
                </PressableScale>
                </View>
              );
            })}
          </View>
        ))}

        <View style={styles.footer}>
          <PressableScale onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancelar" style={styles.footerButton}>
            <ThemedText type="smallBold">Cancelar</ThemedText>
          </PressableScale>
          <PressableScale
            onPress={() => onSelect(today)}
            disabled={today > max}
            accessibilityRole="button"
            accessibilityLabel="Elegir hoy"
            style={styles.footerButton}>
            <ThemedText type="smallBold" style={{ color: theme.primaryText }}>Hoy</ThemedText>
          </PressableScale>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = makeStyles((t) => ({
  backdrop: { flex: 1, justifyContent: 'center', padding: t.space.three },
  card: { borderRadius: t.radius.card, borderWidth: StyleSheet.hairlineWidth, padding: t.space.three, gap: t.space.one, maxWidth: t.size.calendar, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: t.space.two },
  title: { flex: 1, textAlign: 'center' },
  arrow: { width: t.size.touch, height: t.size.touch, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row' },
  // 7 columnas exactamente iguales para encabezados, casillas vacías y días.
  col: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center', minHeight: t.size.touch },
  // El círculo nunca es más ancho que su columna (teléfonos angostos).
  day: { width: '100%', maxWidth: t.size.calendarDay, aspectRatio: 1, borderRadius: t.size.calendarDay / 2, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.3 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: t.space.two, marginTop: t.space.two },
  footerButton: { minHeight: t.size.touch, paddingHorizontal: t.space.three, justifyContent: 'center' },
}));
