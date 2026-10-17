import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { PrimaryButton } from '@/components/form';
import { ListRow, ListSection } from '@/components/list-row';
import { ACCOUNT_ICON, IconCircle } from '@/components/icon-circle';
import { HIDDEN_AMOUNT } from '@/components/movement-row';
import { ThemedText } from '@/components/themed-text';
import { UndoHost } from '@/components/undo-toast';
import { accountBalances, ACCOUNT_TYPE_LABEL, type Account } from '@/domain/ledger';
import { formatCOP } from '@/domain/money';
import { useLedger } from '@/hooks/use-ledger';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles } from '@/hooks/use-tokens';

/** Todas las cuentas: activas y archivadas. Tocar una abre su edición. */
export default function AccountsScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const { ledger, error } = useLedger();
  const { settings, loaded } = useSettings();
  const balances = ledger ? accountBalances(ledger.accounts, ledger.transactions) : new Map<string, number>();
  const accounts = ledger?.accounts ?? [];

  const rows = (list: Account[]) =>
    list.map((a) => (
      <ListRow
        key={a.id}
        title={a.name}
        subtitle={ACCOUNT_TYPE_LABEL[a.type]}
        icon={<IconCircle name={ACCOUNT_ICON[a.type]} color={theme.primaryText} />}
        value={settings.hideAmounts || !loaded ? HIDDEN_AMOUNT : formatCOP(balances.get(a.id) ?? 0)}
        onPress={() => router.push({ pathname: '/cuenta-nueva', params: { id: a.id } })}
      />
    ));

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={styles.content}>
        {error ? (
          <ThemedText style={{ color: theme.expense }} accessibilityRole="alert">No se pudieron leer los datos: {error}</ThemedText>
        ) : !ledger ? (
          <ThemedText themeColor="textSecondary">Cargando…</ThemedText>
        ) : accounts.length === 0 ? (
          <ThemedText themeColor="textSecondary">Aún no hay cuentas.</ThemedText>
        ) : null}
        <ListSection title="Activas">{rows(accounts.filter((a) => !a.archived))}</ListSection>
        <ListSection title="Archivadas">{rows(accounts.filter((a) => a.archived))}</ListSection>
        <PrimaryButton label="Nueva cuenta" onPress={() => router.push('/cuenta-nueva')} />
      </ScrollView>
      <UndoHost inTabs={false} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  content: { padding: t.space.three, gap: t.space.four, width: '100%', maxWidth: t.size.maxContent, alignSelf: 'center' },
}));
