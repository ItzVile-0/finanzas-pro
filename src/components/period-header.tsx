import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { PeriodSheet } from '@/components/period-sheet';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { todayLocal } from '@/domain/dates';
import { formatRange, periodLabel, periodRange, type Period } from '@/domain/periods';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles, useTokens } from '@/hooks/use-tokens';

/**
 * Encabezado de periodo de Inicio, la tienda e Informes (es un solo periodo para las tres): pantalla opcional en
 * mayúsculas, título tocable que abre la hoja de periodo y el rango debajo. `onApply` guarda y devuelve si se guardó.
 */
export function PeriodHeader({
  caption,
  period,
  onApply,
  error,
  children,
}: {
  caption?: string;
  period: Period;
  onApply: (p: Period) => Promise<boolean>;
  error?: string | null;
  /** Debajo del rango (p. ej. "Datos de prueba"). */
  children?: ReactNode;
}) {
  const styles = useStyles();
  const theme = useTheme();
  const t = useTokens();
  const [open, setOpen] = useState(false);
  const today = todayLocal();
  const range = periodRange(period, today);
  const label = periodLabel(period, today);
  return (
    <View>
      {caption ? <ThemedText type="caption" themeColor="textSecondary">{caption}</ThemedText> : null}
      <PressableScale
        onPress={() => setOpen(true)}
        style={styles.row}
        accessibilityRole="button"
        accessibilityLabel={`Periodo: ${label}, ${formatRange(range)}`}
        accessibilityHint="Cambia el periodo de Inicio, la tienda e Informes">
        <ThemedText type="title" style={styles.shrink}>{label}</ThemedText>
        <SymbolView name={{ ios: 'chevron.down', android: 'keyboard_arrow_down' }} size={t.icon.xl} tintColor={theme.textSecondary} />
      </PressableScale>
      <ThemedText type="caption" themeColor="textSecondary">{formatRange(range)}</ThemedText>
      <PeriodSheet
        visible={open}
        period={period}
        onApply={async (p) => {
          const ok = await onApply(p);
          if (ok) setOpen(false);
          return ok;
        }}
        onClose={() => setOpen(false)}
        error={error ?? null}
      />
      {error ? (
        <ThemedText type="small" style={{ color: theme.expense }} accessibilityRole="alert">{error}</ThemedText>
      ) : null}
      {children}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.two },
  shrink: { flexShrink: 1 },
}));
