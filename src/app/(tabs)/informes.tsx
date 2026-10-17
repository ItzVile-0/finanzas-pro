import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BudgetRow } from '@/components/budget-row';
import { CategoryIcon, useCategoryColor } from '@/components/category-icon';
import { BarChart } from '@/components/charts/bar-chart';
import { DonutChart } from '@/components/charts/donut-chart';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PrimaryButton } from '@/components/form';
import { DOWN, HIDDEN_AMOUNT, UP } from '@/components/movement-row';
import { Enter, Line, usePanelStyles, Screen } from '@/components/panel';
import { PeriodHeader } from '@/components/period-header';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { exportStoreCsv, exportMovementsCsv } from '@/db/backup';
import { budgetStatuses } from '@/domain/budgets';
import { expensesByCategory, monthlyTotals } from '@/domain/charts';
import { todayLocal } from '@/domain/dates';
import { monthlyProfit, recordTypeOf } from '@/domain/store';
import { formatCOP } from '@/domain/money';
import { formatRange, periodLabel, periodRange, previousRange } from '@/domain/periods';
import { periodComparison } from '@/domain/summary';
import { useAppearance } from '@/hooks/use-appearance';
import { useLedger } from '@/hooks/use-ledger';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles, useTokens } from '@/hooks/use-tokens';

type Csv = 'movements' | 'store';

/** Informes: comparación con el periodo anterior, gráficos, presupuestos del mes, la tienda por mes y CSV. Mismo periodo del Inicio. */
export default function InformesScreen() {
  const t = useTokens();
  const panelStyles = usePanelStyles();
  const styles = useStyles();
  const db = useSQLiteContext();
  const theme = useTheme();
  const { ledger, error } = useLedger();
  const { settings, loaded, error: settingsError, save } = useSettings();
  const colorOf = useCategoryColor();
  const [confirm, setConfirm] = useState<Csv | null>(null);
  const [busy, setBusy] = useState<Csv | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const hidden = settings.hideAmounts;
  const { storeEnabled, storeName } = useAppearance();
  const money = (v: number) => (hidden ? HIDDEN_AMOUNT : formatCOP(v));
  const pct = (v: number) => (hidden ? '•••' : `${v} %`);
  const card = [panelStyles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }];
  const separator = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator };

  if (error) {
    return (
      <Screen>
        <ThemedText style={{ color: theme.expense }} accessibilityRole="alert">No se pudieron leer los datos: {error}</ThemedText>
      </Screen>
    );
  }
  if (!ledger || !loaded) return <Screen />;

  const today = todayLocal();
  const range = periodRange(settings.period, today);
  const prev = previousRange(settings.period, today);
  const label = periodLabel(settings.period, today);
  const cmp = periodComparison(ledger.transactions, range, prev);
  const slices = expensesByCategory(ledger.transactions, ledger.categories, range);
  // Las evoluciones mensuales siempre muestran los últimos 6 meses, sin importar el periodo elegido.
  const months = monthlyTotals(ledger.transactions, today);
  const noMonths = months.every((m) => m.income === 0 && m.expense === 0);
  // Presupuestos: siempre el mes actual (son mensuales).
  const budgets = budgetStatuses(ledger.budgets, ledger.categories, ledger.transactions, today.slice(0, 7));
  const withinBudget = budgets.filter((b) => b.level !== 'over').length;
  const profit = monthlyProfit(ledger.transactions, today);
  const noProfit = profit.months.every((m) => m.sold === 0 && m.invested === 0);
  const hasRecords = ledger.transactions.some((t) => recordTypeOf(t) !== null);
  const profitColor = (v: number) => (hidden ? theme.text : v > 0 ? theme.income : v < 0 ? theme.expense : theme.text);

  const monthsLabel = hidden
    ? 'Evolución mensual de los últimos 6 meses. Cifras ocultas.'
    : `Evolución mensual de los últimos 6 meses. ${months.map((m) => `${m.label}: ingresos ${formatCOP(m.income)}, gastos ${formatCOP(m.expense)}`).join('; ')}`;
  const profitLabel = hidden
    ? `${storeName} en los últimos 6 meses. Cifras ocultas.`
    : `${storeName} en los últimos 6 meses: vendido ${formatCOP(profit.total.sold)}, invertido ${formatCOP(profit.total.invested)}, ganancia ${formatCOP(profit.total.profit)}. ${profit.months
        .map((m) => `${m.label}: vendido ${formatCOP(m.sold)}, invertido ${formatCOP(m.invested)}`)
        .join('; ')}`;

  async function exportCsv(kind: Csv) {
    if (busy) return;
    setBusy(kind);
    setCsvError(null);
    try {
      await (kind === 'movements' ? exportMovementsCsv(db) : exportStoreCsv(db, storeName));
    } catch (e) {
      setCsvError(`No se pudo exportar el CSV: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Enter index={0}>
        <PeriodHeader caption="INFORMES" period={settings.period} onApply={(period) => save({ period })} error={settingsError} />
      </Enter>

      <Enter index={1}>
        <View style={card}>
          <View>
            <ThemedText type="smallBold">Comparado con el periodo anterior</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">{formatRange(prev)}</ThemedText>
          </View>
          <Compare label="Ingresos" now={cmp.current.income} before={cmp.previous.income} change={cmp.change.income} upIsGood money={money} pct={pct} hidden={hidden} />
          <Compare label="Gastos" now={cmp.current.expense} before={cmp.previous.expense} change={cmp.change.expense} money={money} pct={pct} hidden={hidden} style={separator} />
          <Compare label="Ahorro" now={cmp.current.net} before={cmp.previous.net} change={cmp.change.net} upIsGood money={money} pct={pct} hidden={hidden} style={separator} />
          <ThemedText type="caption" themeColor="textSecondary" style={panelStyles.amount}>
            % de ahorro {cmp.current.savingsPct === null ? 'No disponible' : pct(cmp.current.savingsPct)} · antes{' '}
            {cmp.previous.savingsPct === null ? 'No disponible' : pct(cmp.previous.savingsPct)}
          </ThemedText>
        </View>
      </Enter>

      <Enter index={2}>
        <View style={card}>
          <ThemedText type="smallBold">Gastos por categoría · {label}</ThemedText>
          {slices.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">No disponible: sin gastos en este periodo</ThemedText>
          ) : (
            <>
              <View style={styles.chart}>
                <DonutChart
                  parts={slices.map((sl) => ({ key: sl.key, share: sl.share, color: colorOf(sl.color) }))}
                  track={theme.track}
                  background={theme.backgroundElement}
                  center={
                    <>
                      <ThemedText type="caption" themeColor="textSecondary">Total</ThemedText>
                      <ThemedText type="smallBold" style={[panelStyles.amount, styles.donutTotal]} numberOfLines={1} adjustsFontSizeToFit>
                        {money(cmp.current.expense)}
                      </ThemedText>
                    </>
                  }
                />
              </View>
              {slices.map((sl) => (
                <Line
                  key={sl.key}
                  icon={<CategoryIcon icon={sl.icon} color={sl.color} size={t.avatar.xs} />}
                  label={`${sl.label} · ${pct(Math.round(sl.share * 100))}`}
                  value={money(sl.amount)}
                />
              ))}
            </>
          )}
        </View>
      </Enter>

      <Enter index={3}>
        <View style={card} accessible accessibilityLabel={noMonths ? 'Evolución mensual: no disponible, sin movimientos' : monthsLabel}>
          <ThemedText type="smallBold">Evolución mensual · últimos 6 meses</ThemedText>
          {noMonths ? (
            <ThemedText type="small" themeColor="textSecondary">No disponible: sin movimientos en los últimos 6 meses</ThemedText>
          ) : (
            <>
              <BarChart
                groups={months.map((m) => ({ key: m.month, label: m.label, income: m.income, expense: m.expense }))}
                incomeColor={theme.income}
                expenseColor={theme.expense}
              />
              <Legend items={[['Ingresos', theme.income], ['Gastos', theme.expense]]} />
            </>
          )}
        </View>
      </Enter>

      <Enter index={4}>
        <View style={card}>
          <View>
            <ThemedText type="smallBold">Presupuestos · {periodLabel({ key: 'current_month' }, today)}</ThemedText>
            {budgets.length > 0 ? (
              <ThemedText type="caption" themeColor="textSecondary">
                {withinBudget} de {budgets.length} dentro del presupuesto
              </ThemedText>
            ) : null}
          </View>
          {budgets.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">Aún no tienes presupuestos.</ThemedText>
          ) : (
            budgets.map((st, i) => (
              <View key={st.budget.id} style={i > 0 && separator}>
                <BudgetRow status={st} hidden={hidden} onPress={() => router.push({ pathname: '/presupuesto', params: { id: st.budget.id } })} />
              </View>
            ))
          )}
          <PressableScale
            onPress={() => router.push('/presupuestos')}
            accessibilityRole="link"
            accessibilityLabel={budgets.length === 0 ? 'Crear un presupuesto' : 'Ver todos los presupuestos'}
            style={[panelStyles.item, separator]}>
            <ThemedText type="smallBold" style={{ color: theme.primaryText }}>{budgets.length === 0 ? 'Crear presupuesto' : 'Ver todos'}</ThemedText>
          </PressableScale>
        </View>
      </Enter>

      {storeEnabled ? (
      <Enter index={5}>
        <View style={card} accessible accessibilityLabel={noProfit ? `${storeName}: no disponible, sin registros en los últimos 6 meses` : profitLabel}>
          <ThemedText type="smallBold">{storeName} · últimos 6 meses</ThemedText>
          {noProfit ? (
            <ThemedText type="small" themeColor="textSecondary">No disponible: sin registros en los últimos 6 meses</ThemedText>
          ) : (
            <>
              <BarChart
                groups={profit.months.map((m) => ({ key: m.month, label: m.label, income: m.sold, expense: m.invested }))}
                incomeColor={theme.income}
                expenseColor={theme.expense}
              />
              <Legend items={[['Vendido', theme.income], ['Invertido', theme.expense]]} />
              <Line label="Vendido" value={money(profit.total.sold)} />
              <Line label="Invertido" value={money(profit.total.invested)} />
              <Line label="Ganancia de los 6 meses" value={money(profit.total.profit)} color={profitColor(profit.total.profit)} />
              <View style={[styles.months, separator]}>
                {profit.months.map((m) => (
                  <Line key={m.month} label={`Ganancia ${m.label}`} value={money(m.profit)} color={profitColor(m.profit)} />
                ))}
              </View>
            </>
          )}
        </View>
      </Enter>
      ) : null}

      <Enter index={6}>
        <View style={card}>
          <View>
            <ThemedText type="smallBold">Exportar a Excel (CSV)</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">El archivo no va cifrado.</ThemedText>
          </View>
          {csvError ? (
            <ThemedText type="small" style={{ color: theme.expense }} accessibilityRole="alert">{csvError}</ThemedText>
          ) : null}
          <PrimaryButton label="Movimientos personales" onPress={() => setConfirm('movements')} busy={busy === 'movements'} busyLabel="Preparando…" disabled={!!busy} variant="secondary" />
          {/* Con la tienda desactivada sus registros siguen exportándose mientras existan. */}
          {storeEnabled || hasRecords ? (
            <PrimaryButton label={`Registros de ${storeName}`} onPress={() => setConfirm('store')} busy={busy === 'store'} busyLabel="Preparando…" disabled={!!busy} variant="secondary" />
          ) : null}
        </View>
      </Enter>

      <ConfirmDialog
        visible={confirm !== null}
        title="El CSV no está cifrado"
        message={`Cualquiera que tenga el archivo podrá ver tus ${confirm === 'store' ? `registros de ${storeName}` : 'movimientos'}. Compártelo solo donde confíes.`}
        confirmLabel="Exportar"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const kind = confirm;
          setConfirm(null);
          if (kind) void exportCsv(kind);
        }}
      />
    </Screen>
  );
}

/** Una cifra del periodo frente a la del anterior, con flecha y % de cambio (verde si mejora, rojo si empeora). */
function Compare({
  label,
  now,
  before,
  change,
  upIsGood,
  money,
  pct,
  hidden,
  style,
}: {
  label: string;
  now: number;
  before: number;
  change: number | null;
  upIsGood?: boolean;
  money: (v: number) => string;
  pct: (v: number) => string;
  hidden: boolean;
  style?: object;
}) {
  const t = useTokens();
  const panelStyles = usePanelStyles();
  const styles = useStyles();
  const theme = useTheme();
  const better = change !== null && change !== 0 && change > 0 === !!upIsGood;
  const color = change === null || change === 0 ? theme.textSecondary : better ? theme.income : theme.expense;
  const changeText = change === null ? 'No disponible' : change === 0 ? 'Sin cambio' : pct(Math.abs(change));
  const spoken = change === null ? 'cambio no disponible' : change === 0 ? 'sin cambio' : `${change > 0 ? 'subió' : 'bajó'} ${hidden ? '' : `${Math.abs(change)} %`}`;
  return (
    <View style={[styles.compare, style]} accessible accessibilityLabel={`${label}: ${money(now)}, antes ${money(before)}, ${spoken}`}>
      <View style={panelStyles.row}>
        <ThemedText type="small" style={panelStyles.flex}>{label}</ThemedText>
        <ThemedText type="smallBold" style={panelStyles.amount}>{money(now)}</ThemedText>
      </View>
      <View style={panelStyles.row}>
        <ThemedText type="caption" themeColor="textSecondary" style={[panelStyles.flex, panelStyles.amount]}>antes {money(before)}</ThemedText>
        {change ? <SymbolView name={change > 0 ? UP : DOWN} size={t.icon.sm} tintColor={color} /> : null}
        <ThemedText type="caption" style={[panelStyles.amount, { color }]}>{changeText}</ThemedText>
      </View>
    </View>
  );
}

function Legend({ items }: { items: [label: string, color: string][] }) {
  const panelStyles = usePanelStyles();
  const styles = useStyles();
  return (
    <View style={panelStyles.row}>
      {items.map(([label, color]) => (
        <View key={label} style={panelStyles.row}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <ThemedText type="caption" themeColor="textSecondary">{label}</ThemedText>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  chart: { alignItems: 'center', paddingVertical: t.space.two },
  donutTotal: { maxWidth: t.size.donutLabel, textAlign: 'center' },
  dot: { width: t.size.dot, height: t.size.dot, borderRadius: t.size.dot / 2 },
  compare: { gap: t.space.half, paddingTop: t.space.two },
  months: { gap: t.space.two, paddingTop: t.space.three },
}));
