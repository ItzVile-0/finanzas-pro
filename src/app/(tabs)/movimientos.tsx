import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/bottom-sheet';
import { DayList } from '@/components/day-list';
import { ChipGroup, PrimaryButton, type Option } from '@/components/form';
import { PeriodSheet } from '@/components/period-sheet';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { UndoHost } from '@/components/undo-toast';
import { todayLocal } from '@/domain/dates';
import { PERIOD_OPTIONS, periodLabel, periodRange, type Period } from '@/domain/periods';
import { FILTER_TYPE_LABEL, filterMovements, type FilterType } from '@/domain/search';
import { useAppearance } from '@/hooks/use-appearance';
import { useLedger } from '@/hooks/use-ledger';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles, useTokens } from '@/hooks/use-tokens';

// '' = sin ese filtro (los chips necesitan un valor de texto para "Todos").
type Filters = { type: FilterType | ''; accountId: string; categoryId: string; period: Period | null };
const EMPTY: Filters = { type: '', accountId: '', categoryId: '', period: null };
const PERSONAL_TYPES: FilterType[] = ['income', 'expense', 'transfer'];

export default function MovimientosScreen() {
  const styles = useStyles();
  const t = useTokens();
  const theme = useTheme();
  const { ledger, error } = useLedger();
  const { settings } = useSettings();
  const { storeEnabled, storeName } = useAppearance();
  const { height } = useWindowDimensions();
  const [text, setText] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [sheet, setSheet] = useState<'filters' | 'period' | null>(null);

  const today = todayLocal();
  const all = ledger?.transactions ?? [];
  // Inversión y venta solo si la tienda está activa o ya hay registros suyos.
  const types = storeEnabled || all.some((tx) => tx.scope === 'business') ? [...PERSONAL_TYPES, 'investment' as const, 'sale' as const] : PERSONAL_TYPES;
  const accounts = (ledger?.accounts ?? []).filter((a) => !a.archived || all.some((tx) => tx.account_id === a.id || tx.to_account_id === a.id));
  // Categorías personales (las de la tienda no se eligen), del tipo elegido si es ingreso o gasto.
  const categories = (ledger?.categories ?? []).filter(
    (c) => c.scope === 'personal' && (filters.type === 'income' || filters.type === 'expense' ? c.kind === filters.type : true),
  );
  const range = filters.period ? periodRange(filters.period, today) : null;
  const items = ledger
    ? filterMovements(
        all,
        { text, type: filters.type || null, accountId: filters.accountId || null, categoryId: filters.categoryId || null, range },
        { accounts: ledger.accounts, categories: ledger.categories, channels: ledger.channels },
      )
    : [];
  const filtering = text.trim() !== '' || filters.type !== '' || filters.accountId !== '' || filters.categoryId !== '' || filters.period !== null;
  const count = [filters.type, filters.accountId, filters.categoryId].filter(Boolean).length + (filters.period ? 1 : 0);

  const nameOf = (list: readonly { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name ?? '';
  const active: { label: string; clear: () => void }[] = [
    filters.type ? { label: FILTER_TYPE_LABEL[filters.type], clear: () => setFilters({ ...filters, type: '' }) } : null,
    filters.accountId ? { label: nameOf(accounts, filters.accountId), clear: () => setFilters({ ...filters, accountId: '' }) } : null,
    filters.categoryId ? { label: nameOf(ledger?.categories ?? [], filters.categoryId), clear: () => setFilters({ ...filters, categoryId: '' }) } : null,
    filters.period ? { label: periodLabel(filters.period, today), clear: () => setFilters({ ...filters, period: null }) } : null,
  ].filter((x) => x !== null);

  const typeOptions: Option<FilterType | ''>[] = [{ value: '', label: 'Todos' }, ...types.map((v) => ({ value: v, label: FILTER_TYPE_LABEL[v] }))];
  const periodOptions: Option<string>[] = [{ value: '', label: 'Todo' }, ...PERIOD_OPTIONS.map((o) => ({ value: o.key, label: o.label }))];

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Todo lo que mueve el saldo de las cuentas, también la tienda (con su etiqueta). Ya viene ordenado desde SQL. */}
      <DayList
        items={items}
        categories={ledger?.categories ?? []}
        channels={ledger?.channels ?? []}
        hidden={settings.hideAmounts}
        onOpen={(item) =>
          item.scope === 'business'
            ? router.push({ pathname: '/tienda-registro', params: { id: item.id } })
            : router.push({ pathname: '/movimiento-nuevo', params: { id: item.id } })
        }
        header={
          <View style={styles.header}>
            <ThemedText type="title" accessibilityRole="header">Movimientos</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {storeEnabled ? `Personales y de ${storeName}` : 'Todos tus movimientos'} · toca uno para editarlo o eliminarlo
            </ThemedText>
            <View style={[styles.search, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <SymbolView name={{ ios: 'magnifyingglass', android: 'search' }} size={t.icon.md} tintColor={theme.textSecondary} />
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Buscar en notas, categorías y cuentas"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { color: theme.text }]}
                accessibilityLabel="Buscar movimientos"
                returnKeyType="search"
                maxLength={100}
              />
              {text ? (
                <PressableScale onPress={() => setText('')} accessibilityRole="button" accessibilityLabel="Borrar búsqueda" style={styles.icon}>
                  <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel' }} size={t.icon.md} tintColor={theme.textSecondary} />
                </PressableScale>
              ) : null}
              <PressableScale
                onPress={() => setSheet('filters')}
                accessibilityRole="button"
                accessibilityLabel={count > 0 ? `Filtros, ${count} puestos` : 'Filtros'}
                style={styles.icon}>
                <SymbolView name={{ ios: 'line.3.horizontal.decrease.circle', android: 'filter_list' }} size={t.icon.lg} tintColor={count > 0 ? theme.primaryText : theme.text} />
              </PressableScale>
            </View>
            {active.length > 0 ? (
              <View style={styles.pills}>
                {active.map((a) => (
                  <PressableScale
                    key={a.label}
                    onPress={a.clear}
                    accessibilityRole="button"
                    accessibilityLabel={`Quitar filtro ${a.label}`}
                    style={[styles.pill, { borderColor: theme.primaryBorder, backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="small">{a.label}</ThemedText>
                    <SymbolView name={{ ios: 'xmark', android: 'close' }} size={t.icon.sm} tintColor={theme.textSecondary} />
                  </PressableScale>
                ))}
              </View>
            ) : null}
            {filtering && ledger ? (
              <View style={styles.row}>
                <ThemedText type="caption" themeColor="textSecondary" style={styles.flex} accessibilityLiveRegion="polite">
                  {items.length === 1 ? '1 resultado' : `${items.length} resultados`}
                </ThemedText>
                <PressableScale
                  onPress={() => {
                    setText('');
                    setFilters(EMPTY);
                  }}
                  accessibilityRole="button"
                  style={styles.link}>
                  <ThemedText type="smallBold" style={{ color: theme.primaryText }}>Limpiar</ThemedText>
                </PressableScale>
              </View>
            ) : null}
            {error ? (
              <ThemedText style={[styles.error, { color: theme.expense }]} accessibilityRole="alert">
                No se pudieron leer los datos: {error}
              </ThemedText>
            ) : null}
          </View>
        }
        ready={!!ledger || !!error}
        empty={error ? '' : !ledger ? 'Cargando…' : filtering ? 'Sin resultados con esta búsqueda y estos filtros.' : 'Aún no hay movimientos.'}
      />
      <UndoHost inTabs />

      <BottomSheet visible={sheet === 'filters'} onClose={() => setSheet(null)} title="Filtros">
        <ScrollView style={{ maxHeight: height * 0.6 }} contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
          <ChipGroup
            label="Tipo"
            options={typeOptions}
            value={filters.type}
            // Al cambiar de tipo, una categoría que ya no corresponde se quita.
            onChange={(type) => {
              const keep = ledger?.categories.find((c) => c.id === filters.categoryId);
              const fits = !keep || (type !== 'income' && type !== 'expense') || keep.kind === type;
              setFilters({ ...filters, type, categoryId: fits ? filters.categoryId : '' });
            }}
          />
          <ChipGroup label="Cuenta" options={[{ value: '', label: 'Todas' }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]} value={filters.accountId} onChange={(accountId) => setFilters({ ...filters, accountId })} />
          {filters.type === 'transfer' || filters.type === 'investment' || filters.type === 'sale' ? null : (
            <ChipGroup label="Categoría" options={[{ value: '', label: 'Todas' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} value={filters.categoryId} onChange={(categoryId) => setFilters({ ...filters, categoryId })} />
          )}
          <ChipGroup
            label="Periodo"
            options={periodOptions}
            value={filters.period ? filters.period.key : ''}
            onChange={(key) => {
              if (key === 'custom') setSheet('period');
              else setFilters({ ...filters, period: key ? ({ key } as Period) : null });
            }}
          />
          <PrimaryButton label={`Ver ${items.length === 1 ? '1 resultado' : `${items.length} resultados`}`} onPress={() => setSheet(null)} />
          <PrimaryButton label="Quitar filtros" variant="secondary" disabled={count === 0} onPress={() => setFilters(EMPTY)} />
        </ScrollView>
      </BottomSheet>
      <PeriodSheet
        visible={sheet === 'period'}
        period={filters.period ?? { key: 'current_month' }}
        onApply={async (period) => {
          setFilters({ ...filters, period });
          setSheet(null);
          return true;
        }}
        onClose={() => setSheet(null)}
        error={null}
      />
    </SafeAreaView>
  );
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1 },
  header: { gap: t.space.two },
  error: { marginTop: t.space.three },
  search: { flexDirection: 'row', alignItems: 'center', gap: t.space.two, paddingLeft: t.space.three, borderWidth: t.border.thin, borderRadius: t.radius.field, minHeight: t.size.touch },
  input: { flex: 1, fontFamily: t.font.regular, fontSize: t.type.default.fontSize, paddingVertical: t.space.two },
  icon: { width: t.size.touch, height: t.size.touch, alignItems: 'center', justifyContent: 'center' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.two },
  pill: { flexDirection: 'row', alignItems: 'center', gap: t.space.one, borderWidth: t.border.thin, borderRadius: t.radius.pill, paddingHorizontal: t.space.three, minHeight: t.size.touch },
  row: { flexDirection: 'row', alignItems: 'center' },
  link: { minHeight: t.size.touch, justifyContent: 'center', paddingHorizontal: t.space.two },
  sheet: { gap: t.space.four, paddingBottom: t.space.two },
}));
