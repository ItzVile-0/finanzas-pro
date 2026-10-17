import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/form';
import { RecurringRow } from '@/components/recurring-row';
import { ThemedText } from '@/components/themed-text';
import { UndoHost } from '@/components/undo-toast';
import { todayLocal } from '@/domain/dates';
import { lastPaidDue } from '@/domain/recurring';
import { useLedger } from '@/hooks/use-ledger';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles } from '@/hooks/use-tokens';

/** Pagos recurrentes: activos por próxima cuota y luego los pausados. Tocar uno abre su edición (pagar, omitir, pausar). */
export default function RecurringListScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const { ledger, error } = useLedger();
  const { settings } = useSettings();
  const today = todayLocal();
  // El libro ya los trae por next_due_date; los pausados van al final.
  const items = ledger ? [...ledger.recurring].sort((a, b) => Number(b.active) - Number(a.active)) : [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={styles.content}>
        {error ? (
          <ThemedText style={{ color: theme.expense }} accessibilityRole="alert">No se pudieron leer los datos: {error}</ThemedText>
        ) : !ledger ? (
          <ThemedText themeColor="textSecondary">Cargando…</ThemedText>
        ) : items.length === 0 ? (
          <ThemedText themeColor="textSecondary">Aún no hay pagos recurrentes. Crea uno para tus gastos fijos (arriendo, servicios…).</ThemedText>
        ) : (
          <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            {items.map((r, i) => (
              <View key={r.id} style={i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator }}>
                <RecurringRow
                  item={r}
                  category={ledger.categories.find((c) => c.id === r.category_id)}
                  today={today}
                  lastPaid={lastPaidDue(r.id, ledger.transactions)}
                  hidden={settings.hideAmounts}
                  onPress={() => router.push({ pathname: '/recurrente', params: { id: r.id } })}
                />
              </View>
            ))}
          </View>
        )}
        <ThemedText type="caption" themeColor="textSecondary">
          Un pago programado no cambia tus saldos: solo al pagarlo se registra el gasto real.
        </ThemedText>
        <PrimaryButton label="Nuevo pago recurrente" onPress={() => router.push('/recurrente')} />
      </ScrollView>
      <UndoHost inTabs={false} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  content: { padding: t.space.three, gap: t.space.three, width: '100%', maxWidth: t.size.maxContent, alignSelf: 'center' },
  card: { paddingHorizontal: t.space.three, paddingVertical: t.space.one, borderRadius: t.radius.card, borderWidth: StyleSheet.hairlineWidth },
}));
