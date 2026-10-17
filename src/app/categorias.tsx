import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { PrimaryButton } from '@/components/form';
import { CategoryIcon } from '@/components/category-icon';
import { ListRow, ListSection } from '@/components/list-row';
import { ThemedText } from '@/components/themed-text';
import { UndoHost } from '@/components/undo-toast';
import { PAYROLL_CATEGORY_ID, type Category } from '@/domain/ledger';
import { useLedger } from '@/hooks/use-ledger';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles } from '@/hooks/use-tokens';

/** Categorías personales (las de la tienda son fijas y no se muestran). Tocar una abre su edición. */
export default function CategoriesScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const { ledger, error } = useLedger();
  const personal = (ledger?.categories ?? []).filter((c) => c.scope === 'personal');

  const rows = (list: Category[], showKind = false) =>
    list.map((c) => (
      <ListRow
        key={c.id}
        title={c.name}
        icon={<CategoryIcon icon={c.icon} color={c.color} />}
        subtitle={
          c.id === PAYROLL_CATEGORY_ID ? 'Protegida: la usa el resumen de ingresos' : showKind ? (c.kind === 'income' ? 'Ingreso' : 'Gasto') : undefined
        }
        onPress={() => router.push({ pathname: '/categoria', params: { id: c.id } })}
      />
    ));

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={styles.content}>
        {error ? (
          <ThemedText style={{ color: theme.expense }} accessibilityRole="alert">No se pudieron leer los datos: {error}</ThemedText>
        ) : !ledger ? (
          <ThemedText themeColor="textSecondary">Cargando…</ThemedText>
        ) : null}
        <PrimaryButton label="Nueva categoría" onPress={() => router.push('/categoria')} />
        <ListSection title="Ingresos">{rows(personal.filter((c) => !c.archived && c.kind === 'income'))}</ListSection>
        <ListSection title="Gastos">{rows(personal.filter((c) => !c.archived && c.kind === 'expense'))}</ListSection>
        <ListSection title="Archivadas">{rows(personal.filter((c) => c.archived), true)}</ListSection>
      </ScrollView>
      <UndoHost inTabs={false} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  content: { padding: t.space.three, gap: t.space.four, width: '100%', maxWidth: t.size.maxContent, alignSelf: 'center' },
}));
