import { Redirect, router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';

import { PrimaryButton } from '@/components/form';
import { BudgetRow } from '@/components/budget-row';
import { CategoryIcon } from '@/components/category-icon';
import { AnimatedRow } from '@/components/animated-row';
import { Breathing } from '@/components/breathing';
import { FitText } from '@/components/fit-text';
import { Grow } from '@/components/grow';
import { Greeting } from '@/components/greeting';
import { haptics } from '@/components/haptics';
import { ACCOUNT_ICON, IconCircle } from '@/components/icon-circle';
import { DOWN, HIDDEN_AMOUNT, MovementRow, UP } from '@/components/movement-row';
import { Enter, Figure, Line, Screen } from '@/components/panel';
import { PeriodHeader } from '@/components/period-header';
import { PressableScale } from '@/components/pressable-scale';
import { RecurringRow } from '@/components/recurring-row';
import { ThemedText } from '@/components/themed-text';
import { useUndoLiftStyle } from '@/components/undo-toast';
import { backupReminder } from '@/domain/backup';
import { budgetAlerts } from '@/domain/budgets';
import { todayLocal } from '@/domain/dates';
import { storeSummary } from '@/domain/store';
import type { HomeCardId } from '@/domain/home-cards';
import { isPersonalMovement, PAYROLL_CATEGORY_ID } from '@/domain/ledger';
import { formatCOP } from '@/domain/money';
import { periodLabel, periodRange } from '@/domain/periods';
import { lastPaidDue, upcoming } from '@/domain/recurring';
import { personalSummary } from '@/domain/summary';
import { useCountUp } from '@/hooks/use-count-up';
import { useHideOnScroll } from '@/hooks/use-hide-on-scroll';
import { useAppearance } from '@/hooks/use-appearance';
import { useLedger } from '@/hooks/use-ledger';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles, useTokens } from '@/hooks/use-tokens';

const RECENT_COUNT = 5;

export default function PanelScreen() {
  const t = useTokens();
  const styles = useStyles();
  const theme = useTheme();
  const { ledger, error } = useLedger();
  const { settings, loaded, error: settingsError, save } = useSettings();
  const hidden = settings.hideAmounts;
  const { storeEnabled, storeName } = useAppearance();
  const today = todayLocal();
  const range = periodRange(settings.period, today);
  const label = periodLabel(settings.period, today);
  const s = ledger ? personalSummary(ledger.accounts, ledger.categories, ledger.transactions, range) : null;
  const shownTotal = useCountUp(s?.total ?? 0);
  // El + baja hasta salir de la vista (su alto + su margen + aire) al desplazar hacia abajo.
  const fab = useHideOnScroll(t.size.fab + t.space.three + t.space.four);
  const undoLift = useUndoLiftStyle();

  const money = (v: number) => (hidden ? HIDDEN_AMOUNT : formatCOP(v));
  const pct = (v: number) => (hidden ? '•••' : `${v} %`);
  const card = [styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }];
  const separator = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator };

  if (error) {
    return (
      <Screen>
        <ThemedText style={{ color: theme.expense }} accessibilityRole="alert">No se pudieron leer los datos: {error}</ThemedText>
      </Screen>
    );
  }
  if (!ledger || !s || !loaded) return <Screen />;
  // Primera vez (sin cuentas y sin haber visto la bienvenida): nombre, tienda y primera cuenta.
  if (!settings.onboardingDone && ledger.accounts.length === 0) return <Redirect href="/bienvenida" />;

  const header = (
    <Enter index={0}>
      {settings.userName ? <Greeting name={settings.userName} /> : null}
      <PeriodHeader period={settings.period} onApply={(period) => save({ period })} error={settingsError}>
        {ledger.accounts.some((a) => a.name.startsWith('[PRUEBA]')) && (
          <ThemedText type="caption" themeColor="textSecondary">Datos de prueba</ThemedText>
        )}
      </PeriodHeader>
    </Enter>
  );

  if (s.accounts.length === 0) {
    return (
      <Screen>
        {header}
        <Enter index={1}>
          <View style={[card, styles.empty]}>
            <Breathing>
              <IconCircle name={{ ios: 'wallet.pass', android: 'account_balance_wallet' }} color={theme.primaryText} size={t.avatar.hero} />
            </Breathing>
            <ThemedText type="subtitle" style={styles.center}>Crea tu primera cuenta</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              Agrega tu banco, efectivo o ahorros con su saldo de hoy para empezar.
            </ThemedText>
            <PrimaryButton label="Crear cuenta" onPress={() => router.push('/cuenta-nueva')} />
          </View>
        </Enter>
      </Screen>
    );
  }

  // "Últimos movimientos" NO depende del periodo: siempre los RECENT_COUNT más recientes.
  // Alertas de presupuesto: siempre el mes actual, sin importar el periodo del Panel.
  const alerts = budgetAlerts(ledger.budgets, ledger.categories, ledger.transactions, today.slice(0, 7));
  // Próximos pagos: vencidos y los de los próximos 7 días, tampoco dependen del periodo.
  const dues = upcoming(ledger.recurring, today);
  // Recordatorio de copia: más de 7 días sin exportar (o nunca), solo si ya hay movimientos.
  const reminder = backupReminder(settings.lastBackupAt, today, ledger.transactions.length > 0);

  const recent = ledger.transactions.filter(isPersonalMovement).slice(0, RECENT_COUNT);
  const categoryById = new Map(ledger.categories.map((c) => [c.id, c]));
  const categoryOf = (id: string | null) => (id ? categoryById.get(id) : undefined);
  // Ícono de cada línea del desglose: Nómina y el resto por su categoría.
  const lineIcon = (key: string) => {
    const c = categoryOf(key === 'payroll' ? PAYROLL_CATEGORY_ID : key);
    return c ? <CategoryIcon icon={c.icon} color={c.color} size={t.avatar.xs} /> : undefined;
  };
  // La tienda en el mismo periodo del Panel; la acumulada no depende del periodo.
  const e = storeSummary(ledger.transactions, range);
  const profitColor = (v: number) => (v > 0 ? theme.income : v < 0 ? theme.expense : theme.text);

  // Tarjetas que el usuario ordena y muestra u oculta (Ajustes → Tarjetas del Inicio). Las alertas y los próximos pagos
  // solo aparecen cuando hay algo que mostrar.
  const cardViews: Record<HomeCardId, ReactNode> = {
    // Sin tienda (bienvenida o Ajustes → Tienda) no hay tarjeta.
    store: !storeEnabled ? null : (
      <PressableScale
        onPress={() => router.navigate('/tienda')}
        accessibilityRole="link"
        accessibilityHint={`Abre la pestaña ${storeName}`}
        accessibilityLabel={
          hidden
            ? `${storeName}: cifras ocultas`
            : e.hasRecords
              ? `${storeName}, ganancia del periodo ${formatCOP(e.period.profit)}, invertido ${formatCOP(e.period.invested)}, vendido ${formatCOP(e.period.sold)}, ganancia acumulada ${formatCOP(e.cumulative.profit)}`
              : `${storeName}: registra inversiones y ventas`
        }
        style={card}>
        <View style={styles.row}>
          <IconCircle name={{ ios: 'bag', android: 'storefront' }} color={theme.business} />
          <View style={styles.flex}>
            <ThemedText type="caption" themeColor="textSecondary">{storeName.toLocaleUpperCase('es-CO')} · GANANCIA DEL PERIODO</ThemedText>
            {e.hasRecords ? (
              <>
                <ThemedText type="subtitle" style={[styles.amount, { color: hidden ? theme.text : profitColor(e.period.profit) }]}>
                  {money(e.period.profit)}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary" style={styles.amount}>
                  Invertido {money(e.period.invested)} · Vendido {money(e.period.sold)}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary" style={styles.amount}>
                  Acumulada {money(e.cumulative.profit)}
                </ThemedText>
              </>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">Registra inversiones y ventas</ThemedText>
            )}
          </View>
          <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right' }} size={t.icon.chevron} tintColor={theme.textSecondary} />
        </View>
      </PressableScale>
    ),
    budgets:
      alerts.length > 0 ? (
        <View style={card}>
          <ThemedText type="smallBold">Presupuestos · {periodLabel({ key: 'current_month' }, today)}</ThemedText>
          {alerts.map((st, i) => (
            <View key={st.budget.id} style={i > 0 && separator}>
              <BudgetRow
                status={st}
                hidden={hidden}
                onPress={() => router.push({ pathname: '/presupuesto', params: { id: st.budget.id } })}
              />
            </View>
          ))}
          <PressableScale
            onPress={() => router.push('/presupuestos')}
            accessibilityRole="link"
            accessibilityLabel="Ver todos los presupuestos"
            style={[styles.item, separator]}>
            <ThemedText type="smallBold" style={{ color: theme.primaryText }}>Ver todos</ThemedText>
          </PressableScale>
        </View>
      ) : null,
    upcoming:
      dues.length > 0 ? (
        <View style={card}>
          <ThemedText type="smallBold">Próximos pagos</ThemedText>
          {dues.map((r, i) => (
            <View key={r.id} style={i > 0 && separator}>
              <RecurringRow
                item={r}
                category={categoryOf(r.category_id)}
                today={today}
                lastPaid={lastPaidDue(r.id, ledger.transactions)}
                hidden={hidden}
                hint="Abre el pago de esta cuota"
                onPress={() => router.push({ pathname: '/movimiento-nuevo', params: { recurrente: r.id } })}
              />
            </View>
          ))}
          <PressableScale
            onPress={() => router.push('/recurrentes')}
            accessibilityRole="link"
            accessibilityLabel="Ver todos los pagos recurrentes"
            style={[styles.item, separator]}>
            <ThemedText type="smallBold" style={{ color: theme.primaryText }}>Ver todos</ThemedText>
          </PressableScale>
        </View>
      ) : null,
    income: (
      <View style={card}>
        <ThemedText type="smallBold">Ingresos · {label}</ThemedText>
        {s.incomeLines.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">Sin ingresos en este periodo</ThemedText>
        ) : (
          s.incomeLines.map((l) => (
            <Line key={l.key} icon={lineIcon(l.key)} label={l.label} value={money(l.amount)} />
          ))
        )}
      </View>
    ),
    accounts: (
      <>
        <ThemedText type="smallBold" style={styles.sectionTitle}>Cuentas</ThemedText>
        <View style={[styles.list, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          {s.accounts.map((a, i) => (
            <PressableScale
              key={a.id}
              onPress={() => router.push({ pathname: '/cuenta-nueva', params: { id: a.id } })}
              style={[styles.row, styles.item, i > 0 && separator]}
              accessible
              accessibilityRole="button"
              accessibilityHint="Abre la cuenta para editarla"
              accessibilityLabel={`${a.name}: ${hidden ? 'saldo oculto' : formatCOP(a.balance)}`}>
              <IconCircle name={ACCOUNT_ICON[a.type]} color={theme.primaryText} />
              <ThemedText style={styles.flex} numberOfLines={1}>{a.name}</ThemedText>
              <ThemedText type="smallBold" style={[styles.amount, a.balance < 0 && { color: theme.expense }]}>
                {money(a.balance)}
              </ThemedText>
            </PressableScale>
          ))}
        </View>
      </>
    ),
    recent: (
      <>
        <ThemedText type="smallBold" style={styles.sectionTitle}>Últimos movimientos</ThemedText>
        <View style={[styles.list, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          {recent.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.item}>
              Aún no hay movimientos. Toca + para registrar el primero.
            </ThemedText>
          ) : (
            <LayoutAnimationConfig skipEntering>
              {recent.map((t, i) => (
                <AnimatedRow key={t.id}>
                  <MovementRow
                    tx={t}
                    category={categoryOf(t.category_id)}
                    hidden={hidden}
                    style={i > 0 && separator}
                    onPress={() => router.push({ pathname: '/movimiento-nuevo', params: { id: t.id } })}
                  />
                </AnimatedRow>
              ))}
            </LayoutAnimationConfig>
          )}
          <PressableScale
            onPress={() => router.navigate('/movimientos')}
            accessibilityRole="link"
            accessibilityLabel="Ver todos los movimientos"
            style={[styles.item, separator]}>
            <ThemedText type="smallBold" style={{ color: theme.primaryText }}>Ver todos</ThemedText>
          </PressableScale>
        </View>
      </>
    ),
  };
  const shownCards = settings.homeCards.filter((c) => c.visible && cardViews[c.id]);

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <Screen padBottom onScroll={fab.onScroll}>
        {header}

        <Enter index={1}>
          <View style={[styles.card, { backgroundColor: theme.highlight, borderColor: theme.primaryBorder }]}>
            <View style={styles.row}>
              <ThemedText type="caption" themeColor="textSecondary" style={styles.flex}>SALDO TOTAL</ThemedText>
              <PressableScale
                onPress={() => {
                  haptics.toggle(!hidden);
                  save({ hideAmounts: !hidden });
                }}
                accessibilityRole="button"
                accessibilityLabel={hidden ? 'Mostrar cifras' : 'Ocultar cifras'}
                hitSlop={t.size.hitSlop}>
                <SymbolView
                  name={hidden ? { ios: 'eye.slash', android: 'visibility_off' } : { ios: 'eye', android: 'visibility' }}
                  size={t.icon.lg}
                  tintColor={theme.textSecondary}
                />
              </PressableScale>
            </View>
            <FitText style={styles.amount} accessibilityLabel={hidden ? 'Saldo total oculto' : `Saldo total ${formatCOP(s.total)}`}>
              {hidden ? HIDDEN_AMOUNT : formatCOP(shownTotal)}
            </FitText>

            <View style={styles.barBlock}>
              <View style={[styles.bar, { backgroundColor: theme.track }]} importantForAccessibility="no-hide-descendants">
                {s.incomeShare !== null && !hidden && (
                  <Grow signature={String(s.incomeShare)} style={[{ flex: 1, flexDirection: 'row' }]}>
                    <View style={{ flex: s.incomeShare, backgroundColor: theme.income }} />
                    <View style={{ flex: 1 - s.incomeShare, backgroundColor: theme.expense }} />
                  </Grow>
                )}
              </View>
              {s.barPct ? (
                <View style={styles.row}>
                  <ThemedText type="caption" style={[styles.flex, styles.amount, { color: theme.income }]}>Ingresos {pct(s.barPct.income)}</ThemedText>
                  <ThemedText type="caption" style={[styles.amount, { color: theme.expense }]}>Gastos {pct(s.barPct.expense)}</ThemedText>
                </View>
              ) : (
                <ThemedText type="caption" themeColor="textSecondary">Sin movimientos en este periodo</ThemedText>
              )}
            </View>

            <View style={styles.row}>
              <Figure icon={UP} color={theme.income} label="Ingresos" value={money(s.income)} />
              <Figure icon={DOWN} color={theme.expense} label="Gastos" value={money(s.expense)} />
            </View>

            <ThemedText type="caption" themeColor="textSecondary" style={styles.amount}>
              Diferencia {money(s.net)} · Ahorro {s.savingsPct === null ? 'No disponible' : pct(s.savingsPct)}
            </ThemedText>
          </View>
        </Enter>

        {/* El aviso de copia evita perder datos: siempre visible, justo debajo del saldo. */}
        {reminder.show && (
          <Enter index={2}>
            <PressableScale
              onPress={() => router.push('/respaldo')}
              accessibilityRole="link"
              accessibilityHint="Abre Copia de seguridad"
              style={card}>
              <View style={styles.row}>
                <IconCircle name={{ ios: 'externaldrive', android: 'backup' }} color={theme.primaryText} />
                <View style={styles.flex}>
                  <ThemedText type="smallBold">Haz una copia de seguridad</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {reminder.days === null ? 'Aún no has exportado ninguna copia.' : `Tu última copia fue hace ${reminder.days} días.`}
                  </ThemedText>
                </View>
              </View>
            </PressableScale>
          </Enter>
        )}

        {shownCards.map((c, i) => (
          <Enter key={c.id} index={Math.min(i + 2, 6)}>
            {cardViews[c.id]}
          </Enter>
        ))}
      </Screen>

      <Animated.View style={[styles.fabSpot, fab.style]}>
        {/* Mientras se ve el aviso de Deshacer, el + sube por encima de él (con la animación elegida). */}
        <Animated.View style={undoLift}>
          <PressableScale
            onPress={() => router.push('/movimiento-nuevo')}
            accessibilityRole="button"
            accessibilityLabel="Nuevo movimiento"
            style={[styles.fab, { backgroundColor: theme.primary, shadowColor: theme.primary }]}>
            <SymbolView name={{ ios: 'plus', android: 'add' }} size={t.icon.fab} tintColor={theme.onPrimary} />
          </PressableScale>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  card: { padding: t.space.three, borderRadius: t.radius.card, borderWidth: StyleSheet.hairlineWidth, gap: t.space.three },
  list: { paddingHorizontal: t.space.three, paddingVertical: t.space.one, borderRadius: t.radius.card, borderWidth: StyleSheet.hairlineWidth },
  empty: { alignItems: 'center', paddingVertical: t.space.five },
  amount: { fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.two },
  item: { paddingVertical: t.space.two + t.space.half, minHeight: t.size.touch, justifyContent: 'center' },
  barBlock: { gap: t.space.one },
  bar: { height: t.size.bar, borderRadius: t.radius.bar, overflow: 'hidden', flexDirection: 'row' },
  sectionTitle: { marginBottom: t.space.two },
  fabSpot: { position: 'absolute', right: t.space.three, bottom: t.space.three },
  fab: {
    width: t.size.fab,
    height: t.size.fab,
    borderRadius: t.size.fab / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
}));
