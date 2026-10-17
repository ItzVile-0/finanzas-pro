import { View } from 'react-native';

import { CategoryIcon } from '@/components/category-icon';
import { Grow } from '@/components/grow';
import { HIDDEN_AMOUNT } from '@/components/movement-row';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import type { BudgetStatus } from '@/domain/budgets';
import { formatCOP } from '@/domain/money';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles, useTokens } from '@/hooks/use-tokens';

const LEVEL_TEXT = { ok: 'Dentro del presupuesto', alert: 'Llegó a la alerta', over: 'Presupuesto excedido' } as const;

/** Presupuesto de una categoría: ícono, nombre, barra de consumo y "Gastado X de Y". */
export function BudgetRow({ status, hidden, onPress }: { status: BudgetStatus; hidden?: boolean; onPress?: () => void }) {
  const t = useTokens();
  const styles = useStyles();
  const theme = useTheme();
  const { budget, category, spent, remaining, pct, level } = status;
  const color = level === 'over' ? theme.expense : level === 'alert' ? theme.primaryText : theme.income;
  const money = (v: number) => (hidden ? HIDDEN_AMOUNT : formatCOP(v));
  const rest = remaining >= 0 ? `Quedan ${money(remaining)}` : `Te pasaste ${money(-remaining)}`;
  const name = category?.name ?? 'Sin categoría';

  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      style={styles.row}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${name}. ${LEVEL_TEXT[level]}. Gastado ${money(spent)} de ${money(budget.amount)}${hidden ? '' : `, ${pct} %`}. ${rest}`}>
      {category ? <CategoryIcon icon={category.icon} color={category.color} size={t.avatar.md} /> : null}
      <View style={styles.flex}>
        <View style={styles.line}>
          <ThemedText numberOfLines={1} style={styles.flex}>{name}</ThemedText>
          <ThemedText type="smallBold" style={[styles.amount, { color }]}>{hidden ? '•••' : `${pct} %`}</ThemedText>
        </View>
        {/* La barra se llena hasta el 100 %; lo que se pase se ve en el color rojo y en el texto. */}
        <View style={[styles.bar, { backgroundColor: theme.track }]} importantForAccessibility="no-hide-descendants">
          <Grow signature={String(pct)} style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color, borderRadius: t.radius.bar }} />
        </View>
        <ThemedText type="caption" themeColor="textSecondary" style={styles.amount}>
          Gastado {money(spent)} de {money(budget.amount)} · {rest}
        </ThemedText>
      </View>
    </PressableScale>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.two, paddingVertical: t.space.two },
  flex: { flex: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: t.space.two },
  bar: { height: t.size.bar, borderRadius: t.radius.bar, overflow: 'hidden', flexDirection: 'row', marginVertical: t.space.one },
  amount: { fontVariant: ['tabular-nums'] },
}));
