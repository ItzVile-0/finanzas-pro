import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BudgetRow } from '@/components/budget-row';
import { PrimaryButton } from '@/components/form';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { UndoHost } from '@/components/undo-toast';
import { budgetStatuses } from '@/domain/budgets';
import { addMonths } from '@/domain/calendar';
import { formatMonthYear, todayLocal } from '@/domain/dates';
import { useLedger } from '@/hooks/use-ledger';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles, useTokens } from '@/hooks/use-tokens';

const monthTitle = (ym: string) => formatMonthYear(new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1));

/** Presupuestos del mes (por defecto el actual; flechas para ver meses anteriores). Tocar uno abre su edición. */
export default function BudgetsScreen() {
  const t = useTokens();
  const styles = useStyles();
  const theme = useTheme();
  const { ledger, error } = useLedger();
  const { settings } = useSettings();
  const current = todayLocal().slice(0, 7);
  const [month, setMonth] = useState(current);
  const statuses = ledger ? budgetStatuses(ledger.budgets, ledger.categories, ledger.transactions, month) : [];
  const canGoNext = month < current;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={styles.content}>
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

        {error ? (
          <ThemedText style={{ color: theme.expense }} accessibilityRole="alert">No se pudieron leer los datos: {error}</ThemedText>
        ) : !ledger ? (
          <ThemedText themeColor="textSecondary">Cargando…</ThemedText>
        ) : statuses.length === 0 ? (
          <ThemedText themeColor="textSecondary">Aún no hay presupuestos. Crea uno para una categoría de gasto.</ThemedText>
        ) : (
          <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            {statuses.map((s, i) => (
              <View key={s.budget.id} style={i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator }}>
                <BudgetRow
                  status={s}
                  hidden={settings.hideAmounts}
                  onPress={() => router.push({ pathname: '/presupuesto', params: { id: s.budget.id } })}
                />
              </View>
            ))}
          </View>
        )}
        <ThemedText type="caption" themeColor="textSecondary">
          Cada presupuesto es el mismo monto todos los meses; si lo editas, cambia también en los meses anteriores.
        </ThemedText>
        <PrimaryButton label="Nuevo presupuesto" onPress={() => router.push('/presupuesto')} />
      </ScrollView>
      <UndoHost inTabs={false} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  content: { padding: t.space.three, gap: t.space.three, width: '100%', maxWidth: t.size.maxContent, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, textAlign: 'center' },
  arrow: { width: t.size.touch, height: t.size.touch, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.3 },
  card: { paddingHorizontal: t.space.three, paddingVertical: t.space.one, borderRadius: t.radius.card, borderWidth: StyleSheet.hairlineWidth },
}));
