import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { Grow } from '@/components/grow';
import { ThemedText } from '@/components/themed-text';
import { makeStyles, useTokens } from '@/hooks/use-tokens';

/** Barras agrupadas (ingresos vs gastos) por mes; crecen desde abajo cuando cambian los datos. Decorativas: el resumen accesible lo arma quien la usa. */
export function BarChart({
  groups,
  incomeColor,
  expenseColor,
}: {
  groups: { key: string; label: string; income: number; expense: number }[];
  incomeColor: string;
  expenseColor: string;
}) {
  const styles = useStyles();
  const height = useTokens().size.chartHeight;
  const [width, setWidth] = useState(0);
  const max = Math.max(...groups.map((g) => Math.max(g.income, g.expense)), 0);
  const slot = groups.length > 0 ? width / groups.length : 0;
  const bar = Math.min(14, slot / 3);
  const h = (v: number) => (max > 0 && v > 0 ? Math.max((v / max) * height, 2) : 0);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {width > 0 && (
        <Grow axis="y" signature={groups.map((g) => `${g.income}:${g.expense}`).join('|')}>
        <Svg width={width} height={height}>
          {groups.map((g, i) => {
            const x = i * slot + slot / 2;
            return [
              <Rect key={`${g.key}-i`} x={x - bar - 1} y={height - h(g.income)} width={bar} height={h(g.income)} rx={3} fill={incomeColor} />,
              <Rect key={`${g.key}-e`} x={x + 1} y={height - h(g.expense)} width={bar} height={h(g.expense)} rx={3} fill={expenseColor} />,
            ];
          })}
        </Svg>
        </Grow>
      )}
      <View style={styles.labels}>
        {groups.map((g) => (
          <ThemedText key={g.key} type="caption" themeColor="textSecondary" style={styles.label}>{g.label}</ThemedText>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  labels: { flexDirection: 'row', marginTop: t.space.one },
  label: { flex: 1, textAlign: 'center' },
}));
