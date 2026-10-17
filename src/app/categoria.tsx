import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { View } from 'react-native';

import { CategoryStylePicker } from '@/components/category-icon';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { haptics } from '@/components/haptics';
import { ChipGroup, PrimaryButton, TextField, type Option, FormScroll } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { createCategory, deleteCategory, setCategoryArchived, updateCategory } from '@/db/ledger';
import { DEFAULT_COLOR, DEFAULT_ICON, type ColorKey, type IconKey } from '@/domain/category-style';
import { canDeleteCategory, PAYROLL_CATEGORY_ID, type Category } from '@/domain/ledger';
import { useLedger } from '@/hooks/use-ledger';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles } from '@/hooks/use-tokens';

const KINDS: Option<Category['kind']>[] = [
  { value: 'expense', label: 'Gasto' },
  { value: 'income', label: 'Ingreso' },
];

/** Crear (sin id) o editar (?id=) una categoría personal. */
export default function CategoryScreen() {
  const styles = useStyles();
  const db = useSQLiteContext();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { ledger, error: loadError } = useLedger();
  const original = id ? ledger?.categories.find((c) => c.id === id) : undefined;
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Category['kind']>('expense');
  const [style, setStyle] = useState<{ icon: IconKey; color: ColorKey }>({ icon: DEFAULT_ICON, color: DEFAULT_COLOR });
  const [error, setError] = useState<{ name?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [filled, setFilled] = useState(false);
  if (original && !filled) {
    setFilled(true);
    setName(original.name);
    setKind(original.kind);
    setStyle({ icon: original.icon, color: original.color });
  }
  const payroll = id === PAYROLL_CATEGORY_ID;

  async function run(
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    field: 'name' | 'form',
    feel: 'success' | 'warning' = 'success',
  ) {
    if (saving) return;
    setSaving(true);
    try {
      const r = await action();
      if (r.ok) {
        haptics[feel]();
        router.back();
      }
      else setError({ [field]: r.error });
    } catch (e) {
      setError({ form: `No se pudo completar: ${(e as Error).message}` });
    } finally {
      setSaving(false);
    }
  }

  if (loadError || (id && ledger && !original)) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ThemedText style={styles.centerText} accessibilityRole="alert">
          {loadError ? `No se pudieron leer los datos: ${loadError}` : 'Esta categoría ya no existe.'}
        </ThemedText>
        <PrimaryButton label="Volver" onPress={() => router.back()} />
      </View>
    );
  }

  const deleteBlock = original && ledger ? canDeleteCategory(original.id, ledger.transactions) : null;

  return (
    <FormScroll contentStyle={styles.content}>
      {id ? <Stack.Screen options={{ title: 'Editar categoría' }} /> : null}
      <ChipGroup
        label="Tipo"
        options={KINDS.map((o) => ({ ...o, disabled: !!id }))}
        value={kind}
        onChange={setKind}
        hint={id ? 'El tipo no se cambia: sus movimientos dependen de él.' : undefined}
      />
      <TextField
        label="Nombre"
        value={name}
        onChangeText={setName}
        placeholder="Ej.: Mascotas"
        error={error.name}
        maxLength={60}
        editable={!payroll}
        hint={payroll ? 'Nómina no se renombra ni se archiva: el resumen de ingresos depende de ella. Sí puedes cambiar su ícono y color.' : undefined}
      />
      <CategoryStylePicker icon={style.icon} color={style.color} onChange={setStyle} />
      {original?.archived ? (
        <ThemedText type="small" themeColor="textSecondary">Archivada: no aparece en los formularios.</ThemedText>
      ) : null}
      {error.form ? (
        <ThemedText type="small" style={{ color: theme.expense }} accessibilityRole="alert">{error.form}</ThemedText>
      ) : null}
      <PrimaryButton
        label={id ? 'Guardar cambios' : 'Guardar categoría'}
        onPress={() => run(() => (original ? updateCategory(db, original.id, name, style) : createCategory(db, name, kind, style)), 'name')}
        busy={saving || (!!id && !filled)}
      />
      {original && !payroll ? (
        <PrimaryButton
          label={original.archived ? 'Desarchivar categoría' : 'Archivar categoría'}
          onPress={() => run(() => setCategoryArchived(db, original.id, !original.archived), 'form')}
          busy={saving}
          variant="secondary"
        />
      ) : null}
      {original && !payroll ? (
        deleteBlock ? (
          <ThemedText type="small" themeColor="textSecondary">{deleteBlock}</ThemedText>
        ) : (
          <PrimaryButton label="Eliminar categoría" onPress={() => setConfirming(true)} busy={saving} variant="danger" />
        )
      ) : null}
      <ConfirmDialog
        visible={confirming}
        title="¿Eliminar esta categoría?"
        message="No tiene movimientos. No se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          if (original) run(() => deleteCategory(db, original.id), 'form', 'warning');
        }}
      />
    </FormScroll>
  );
}

const useStyles = makeStyles((t) => ({
  content: { padding: t.space.three, gap: t.space.four, width: '100%', maxWidth: t.size.maxContent, alignSelf: 'center' },
  center: { flex: 1, padding: t.space.four, gap: t.space.three, justifyContent: 'center' },
  centerText: { textAlign: 'center' },
}));
