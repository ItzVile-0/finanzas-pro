import { router, Stack } from 'expo-router';
import { View } from 'react-native';

import { DayList } from '@/components/day-list';
import { ThemedText } from '@/components/themed-text';
import { UndoHost } from '@/components/undo-toast';
import { recordTypeOf } from '@/domain/store';
import { useAppearance } from '@/hooks/use-appearance';
import { useLedger } from '@/hooks/use-ledger';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';

/** Todas las inversiones y ventas de la tienda por día, más recientes primero. Tocar una abre su edición. */
export default function StoreRecordsScreen() {
  const theme = useTheme();
  const { storeName } = useAppearance();
  const { settings } = useSettings();
  const { ledger, error } = useLedger();
  const records = (ledger?.transactions ?? []).filter((t) => recordTypeOf(t) !== null);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen options={{ title: `Registros de ${storeName}` }} />
      <DayList
        items={records}
        categories={ledger?.categories ?? []}
        channels={ledger?.channels ?? []}
        hidden={settings.hideAmounts}
        noBusinessTag
        onOpen={(item) => router.push({ pathname: '/tienda-registro', params: { id: item.id } })}
        header={
          error ? (
            <ThemedText style={{ color: theme.expense }} accessibilityRole="alert">
              No se pudieron leer los datos: {error}
            </ThemedText>
          ) : undefined
        }
        ready={!!ledger || !!error}
        empty={error ? '' : ledger ? 'Aún no hay registros.' : 'Cargando…'}
      />
      <UndoHost inTabs={false} />
    </View>
  );
}
