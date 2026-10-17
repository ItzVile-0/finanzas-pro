import { View, type StyleProp, type ViewStyle } from 'react-native';

import { CategoryIcon } from '@/components/category-icon';
import { IconCircle, type IconName } from '@/components/icon-circle';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { formatShortDate } from '@/domain/dates';
import { RECORD_LABEL, recordTypeOf } from '@/domain/store';
import { KIND_LABEL, type Category, type MovementKind, type Transaction } from '@/domain/ledger';
import { formatCOP } from '@/domain/money';
import { useAppearance } from '@/hooks/use-appearance';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles } from '@/hooks/use-tokens';

export const UP: IconName = { ios: 'arrow.up', android: 'arrow_upward' };
export const DOWN: IconName = { ios: 'arrow.down', android: 'arrow_downward' };
export const HIDDEN_AMOUNT = '$ •••••';

const KIND: Record<MovementKind, { sign: string; icon: IconName; color: keyof typeof Colors.light }> = {
  income: { sign: '+', icon: UP, color: 'income' },
  expense: { sign: '−', icon: DOWN, color: 'expense' },
  transfer: { sign: '', icon: { ios: 'arrow.left.arrow.right', android: 'swap_horiz' }, color: 'textSecondary' },
};

/**
 * Fila de movimiento (con onPress abre la edición): ícono (el de la categoría si tiene), nota (o categoría),
 * "Categoría · 10 oct" y el importe con signo. Un registro de la tienda dice "<nombre de la tienda> · Venta · WhatsApp"
 * (sin el nombre con `noBusinessTag`, en las pantallas que ya son de la tienda).
 */
export function MovementRow({
  tx,
  category,
  hidden,
  style,
  onPress,
  noBusinessTag,
  channelName,
}: {
  tx: Transaction;
  category?: Category;
  hidden?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  noBusinessTag?: boolean;
  /** Nombre del canal de una venta. */
  channelName?: string;
}) {
  const styles = useStyles();
  const theme = useTheme();
  const { storeName } = useAppearance();
  const k = KIND[tx.kind];
  const record = recordTypeOf(tx);
  const categoryName = category?.name;
  const color = theme[k.color];
  const label = record
    ? [noBusinessTag ? null : storeName, RECORD_LABEL[record], channelName ?? null].filter(Boolean).join(' · ')
    : (categoryName ?? KIND_LABEL[tx.kind]);
  const title = tx.note || (record ? RECORD_LABEL[record] : null) || categoryName || KIND_LABEL[tx.kind];
  const amount = hidden ? HIDDEN_AMOUNT : `${k.sign}${formatCOP(tx.amount)}`;

  return (
    <PressableScale
      disabled={!onPress}
      onPress={onPress}
      style={[styles.row, style]}
      accessible
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityHint={onPress ? 'Abre el movimiento para editarlo o eliminarlo' : undefined}
      accessibilityLabel={`${title}. ${label}, ${formatShortDate(tx.date)}. ${hidden ? 'Valor oculto' : amount}`}>
      {/* Ingresos, gastos y registros de la tienda muestran el ícono de su categoría; las transferencias, el de su tipo. */}
      {category && (tx.kind === 'income' || tx.kind === 'expense') ? (
        <CategoryIcon icon={category.icon} color={category.color} />
      ) : (
        <IconCircle name={k.icon} color={color} />
      )}
      <View style={styles.flex}>
        <ThemedText numberOfLines={1}>{title}</ThemedText>
        <ThemedText type="small" style={{ color: record ? theme.business : theme.textSecondary }}>
          {label} · {formatShortDate(tx.date)}
        </ThemedText>
      </View>
      <ThemedText type="smallBold" style={[styles.amount, { color }]}>
        {amount}
      </ThemedText>
    </PressableScale>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.two, paddingVertical: t.space.two + t.space.half },
  flex: { flex: 1 },
  amount: { fontVariant: ['tabular-nums'] },
}));
