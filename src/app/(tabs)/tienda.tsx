import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { LayoutAnimationConfig } from 'react-native-reanimated';

import { AnimatedRow } from '@/components/animated-row';
import { Breathing } from '@/components/breathing';
import { FitText } from '@/components/fit-text';
import { Grow } from '@/components/grow';
import { PrimaryButton } from '@/components/form';
import { channelIcon, IconCircle, type IconName } from '@/components/icon-circle';
import { DOWN, HIDDEN_AMOUNT, MovementRow, UP } from '@/components/movement-row';
import { Enter, Figure, usePanelStyles, Screen } from '@/components/panel';
import { PeriodHeader } from '@/components/period-header';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { todayLocal } from '@/domain/dates';
import { storeSummary, recordTypeOf, type RecordType } from '@/domain/store';
import { formatCOP } from '@/domain/money';
import { periodLabel, periodRange } from '@/domain/periods';
import { useAppearance } from '@/hooks/use-appearance';
import { useLedger } from '@/hooks/use-ledger';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles, useTokens } from '@/hooks/use-tokens';

const RECENT_COUNT = 10;

/** Tienda (con su nombre): cuánto invierto y cuánto gano, en el mismo periodo del Inicio. */
export default function StoreScreen() {
  const t = useTokens();
  const panelStyles = usePanelStyles();
  const styles = useStyles();
  const theme = useTheme();
  const { storeName } = useAppearance();
  const { ledger, error } = useLedger();
  const { settings, loaded, error: settingsError, save } = useSettings();
  const hidden = settings.hideAmounts;
  const money = (v: number) => (hidden ? HIDDEN_AMOUNT : formatCOP(v));
  const card = [panelStyles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }];

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
  const label = periodLabel(settings.period, today);
  const e = storeSummary(ledger.transactions, range);
  const profitColor = (v: number) => (hidden ? theme.text : v > 0 ? theme.income : v < 0 ? theme.expense : theme.text);
  const records = ledger.transactions.filter((t) => recordTypeOf(t) !== null);
  const categoryById = new Map(ledger.categories.map((c) => [c.id, c]));
  const categoryOf = (id: string | null) => (id ? categoryById.get(id) : undefined);
  const channelName = new Map(ledger.channels.map((c) => [c.id, c.name]));
  const activeChannels = ledger.channels.filter((c) => !c.archived).map((c) => c.name);
  const open = (type: RecordType) => router.push({ pathname: '/tienda-registro', params: { tipo: type } });

  const header = (
    <Enter index={0}>
      <PeriodHeader caption={storeName} period={settings.period} onApply={(period) => save({ period })} error={settingsError} />
    </Enter>
  );

  if (!ledger.accounts.some((a) => !a.archived)) {
    return (
      <Screen>
        {header}
        <Enter index={1}>
          <View style={[card, styles.empty]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              Las inversiones salen de tus cuentas y las ventas entran a ellas. Primero crea una cuenta.
            </ThemedText>
            <PrimaryButton label="Crear cuenta" onPress={() => router.push('/cuenta-nueva')} />
          </View>
        </Enter>
      </Screen>
    );
  }

  const actions = (
    <Enter index={2}>
      <View style={styles.actions}>
        <Action
          icon={{ ios: 'bag', android: 'shopping_bag' }}
          color={theme.expense}
          title="Registrar inversión"
          hint="Mercancía, empaques, publicidad, envíos"
          onPress={() => open('investment')}
        />
        <Action
          icon={{ ios: 'dollarsign.circle', android: 'sell' }}
          color={theme.income}
          title="Registrar venta"
          hint={activeChannels.length > 0 ? `Por ${activeChannels.join(', ')}` : 'Primero agrega un canal en Ajustes → Tienda'}
          onPress={() => open('sale')}
        />
      </View>
    </Enter>
  );

  if (!e.hasRecords) {
    return (
      <Screen>
        {header}
        <Enter index={1}>
          <View style={[card, styles.empty]}>
            <Breathing>
              <IconCircle name={{ ios: 'bag', android: 'storefront' }} color={theme.business} size={t.avatar.hero} />
            </Breathing>
            <ThemedText type="subtitle" style={styles.center}>Empieza a medir {storeName}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              Registra lo que inviertes en el negocio y lo que vendes. Aquí verás cuánto ganas cada periodo y en total.
            </ThemedText>
          </View>
        </Enter>
        {actions}
      </Screen>
    );
  }

  const soldPct = e.soldShare === null ? null : Math.round(e.soldShare * 100);

  return (
    <Screen>
      {header}

      <Enter index={1}>
        <View
          style={[panelStyles.card, { backgroundColor: theme.highlight, borderColor: theme.primaryBorder }]}
          accessible
          accessibilityLabel={
            hidden
              ? 'Ganancia oculta'
              : `Ganancia del periodo ${formatCOP(e.period.profit)}. Invertido ${formatCOP(e.period.invested)}, vendido ${formatCOP(e.period.sold)}. Ganancia acumulada ${formatCOP(e.cumulative.profit)}`
          }>
          <ThemedText type="caption" themeColor="textSecondary">GANANCIA DEL PERIODO</ThemedText>
          <FitText style={[panelStyles.amount, { color: profitColor(e.period.profit) }]}>{money(e.period.profit)}</FitText>
          <View style={panelStyles.barBlock}>
            <View style={[panelStyles.bar, { backgroundColor: theme.track }]} importantForAccessibility="no-hide-descendants">
              {e.soldShare !== null && !hidden && (
                <Grow signature={String(e.soldShare)} style={[{ flex: 1, flexDirection: 'row' }]}>
                  <View style={{ flex: e.soldShare, backgroundColor: theme.income }} />
                  <View style={{ flex: 1 - e.soldShare, backgroundColor: theme.expense }} />
                </Grow>
              )}
            </View>
            {soldPct === null ? (
              <ThemedText type="caption" themeColor="textSecondary">Sin registros en este periodo</ThemedText>
            ) : (
              <View style={panelStyles.row}>
                <ThemedText type="caption" style={[panelStyles.flex, panelStyles.amount, { color: theme.income }]}>
                  Vendido {hidden ? '•••' : `${soldPct} %`}
                </ThemedText>
                <ThemedText type="caption" style={[panelStyles.amount, { color: theme.expense }]}>
                  Invertido {hidden ? '•••' : `${100 - soldPct} %`}
                </ThemedText>
              </View>
            )}
          </View>
          <View style={panelStyles.row}>
            <Figure icon={DOWN} color={theme.expense} label="Invertido" value={money(e.period.invested)} />
            <Figure icon={UP} color={theme.income} label="Vendido" value={money(e.period.sold)} />
          </View>
          <View style={[styles.cumulative, { borderTopColor: theme.separator }]}>
            <ThemedText type="caption" themeColor="textSecondary" style={panelStyles.flex}>Ganancia acumulada (desde el primer registro)</ThemedText>
            <ThemedText type="smallBold" style={[panelStyles.amount, { color: profitColor(e.cumulative.profit) }]}>{money(e.cumulative.profit)}</ThemedText>
          </View>
        </View>
      </Enter>

      {actions}

      {e.channels.length > 0 && (
        <Enter index={3}>
          <View style={card}>
            <ThemedText type="smallBold">Ventas por canal · {label}</ThemedText>
            {e.channels.map((c) => (
              <View key={c.channel} style={styles.channel} accessible accessibilityLabel={`${channelName.get(c.channel) ?? 'Sin canal'}: ${hidden ? 'oculto' : formatCOP(c.amount)}, ${c.count} ventas`}>
                <View style={panelStyles.row}>
                  <IconCircle name={channelIcon(c.channel)} color={theme.business} size={t.avatar.xs} />
                  <View style={panelStyles.flex}>
                    <ThemedText type="small">{channelName.get(c.channel) ?? 'Sin canal'}</ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {c.count} {c.count === 1 ? 'venta' : 'ventas'} · {hidden ? '•••' : `${Math.round(c.share * 100)} %`}
                    </ThemedText>
                  </View>
                  <ThemedText type="smallBold" style={panelStyles.amount}>{money(c.amount)}</ThemedText>
                </View>
                <View style={[panelStyles.bar, { backgroundColor: theme.track }]}>
                  {!hidden && <View style={{ flex: c.share, backgroundColor: theme.business }} />}
                  {!hidden && <View style={{ flex: 1 - c.share }} />}
                </View>
              </View>
            ))}
          </View>
        </Enter>
      )}

      <Enter index={4}>
        <ThemedText type="smallBold" style={panelStyles.sectionTitle}>Últimos registros</ThemedText>
        <View style={[panelStyles.list, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <LayoutAnimationConfig skipEntering>
            {records.slice(0, RECENT_COUNT).map((t, i) => (
              <AnimatedRow key={t.id}>
                <MovementRow
                  noBusinessTag
                  tx={t}
                  category={categoryOf(t.category_id)}
                  channelName={t.channel_id ? channelName.get(t.channel_id) : undefined}
                  hidden={hidden}
                  style={i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator }}
                  onPress={() => router.push({ pathname: '/tienda-registro', params: { id: t.id } })}
                />
              </AnimatedRow>
            ))}
          </LayoutAnimationConfig>
          {records.length > RECENT_COUNT ? (
            <PressableScale
              onPress={() => router.push('/tienda-registros')}
              accessibilityRole="link"
              accessibilityLabel={`Ver todos los registros de ${storeName}`}
              style={[panelStyles.item, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator }]}>
              <ThemedText type="smallBold" style={{ color: theme.primaryText }}>Ver todos</ThemedText>
            </PressableScale>
          ) : null}
        </View>
      </Enter>
    </Screen>
  );
}

/** Botón grande de acción: ícono, título y una línea de ayuda. */
function Action({ icon, color, title, hint, onPress }: { icon: IconName; color: string; title: string; hint: string; onPress: () => void }) {
  const t = useTokens();
  const styles = useStyles();
  const theme = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={hint}
      style={[styles.action, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <IconCircle name={icon} color={color} size={t.avatar.lg} />
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">{hint}</ThemedText>
    </PressableScale>
  );
}

const useStyles = makeStyles((t) => ({
  center: { textAlign: 'center' },
  empty: { alignItems: 'center', paddingVertical: t.space.five },
  actions: { flexDirection: 'row', gap: t.space.three },
  action: { flex: 1, gap: t.space.two, padding: t.space.three, borderRadius: t.radius.card, borderWidth: StyleSheet.hairlineWidth, minHeight: t.size.actionMinHeight },
  channel: { gap: t.space.two },
  cumulative: { flexDirection: 'row', alignItems: 'center', gap: t.space.two, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: t.space.three },
}));
