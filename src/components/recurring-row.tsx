import { View } from 'react-native';

import { CategoryIcon } from '@/components/category-icon';
import { HIDDEN_AMOUNT } from '@/components/movement-row';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import type { Category } from '@/domain/ledger';
import { formatCOP } from '@/domain/money';
import { dueText, FREQUENCY_LABEL, recurringStatus, type Recurring } from '@/domain/recurring';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles, useTokens } from '@/hooks/use-tokens';

/** Pago recurrente: ícono de la categoría, concepto, estado de la cuota y monto estimado. */
export function RecurringRow({
  item,
  category,
  today,
  lastPaid,
  hidden,
  onPress,
  hint,
}: {
  item: Recurring;
  category?: Category;
  today: string;
  lastPaid: string | null;
  hidden?: boolean;
  onPress: () => void;
  hint?: string;
}) {
  const t = useTokens();
  const styles = useStyles();
  const theme = useTheme();
  const overdue = item.active && recurringStatus(item, today, lastPaid) === 'overdue';
  const status = item.active ? dueText(item, today, lastPaid) : 'Pausado';
  const amount = hidden ? HIDDEN_AMOUNT : formatCOP(item.estimated_amount);
  return (
    <PressableScale
      onPress={onPress}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={`${item.concept}. ${FREQUENCY_LABEL[item.frequency]}. ${status}. Estimado ${amount}`}
      accessibilityHint={hint}>
      {category ? <CategoryIcon icon={category.icon} color={category.color} size={t.avatar.md} /> : null}
      <View style={styles.flex}>
        <ThemedText numberOfLines={1}>{item.concept}</ThemedText>
        <ThemedText type="caption" style={{ color: overdue ? theme.expense : theme.textSecondary }}>
          {FREQUENCY_LABEL[item.frequency]} · {status}
        </ThemedText>
      </View>
      <ThemedText type="smallBold" style={styles.amount}>{amount}</ThemedText>
    </PressableScale>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.two, paddingVertical: t.space.two },
  flex: { flex: 1 },
  amount: { fontVariant: ['tabular-nums'] },
}));
