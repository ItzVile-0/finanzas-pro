import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { View } from 'react-native';

import { CategoryGrid } from '@/components/category-icon';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { AmountField, FormScroll, PrimaryButton, TextField } from '@/components/form';
import { haptics } from '@/components/haptics';
import { ThemedText } from '@/components/themed-text';
import { useNotify } from '@/components/undo-toast';
import { deleteBudget, saveBudget } from '@/db/ledger';
import { DEFAULT_ALERT_PCT, type BudgetErrors } from '@/domain/budgets';
import { formatCOPInput, parseCOP } from '@/domain/money';
import { useLedger } from '@/hooks/use-ledger';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles } from '@/hooks/use-tokens';

/** Crear (sin id) o editar (?id=) un presupuesto mensual de una categoría de gasto. */
export default function BudgetScreen() {
  const styles = useStyles();
  const db = useSQLiteContext();
  const notify = useNotify();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { ledger, error: loadError } = useLedger();
  const original = id ? ledger?.budgets.find((b) => b.id === id) : undefined;
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [alert, setAlert] = useState(String(DEFAULT_ALERT_PCT));
  const [errors, setErrors] = useState<BudgetErrors & { form?: string }>({});
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [filled, setFilled] = useState(false);
  if (original && !filled) {
    setFilled(true);
    setCategoryId(original.category_id);
    setAmount(formatCOPInput(String(original.amount)));
    setAlert(String(original.alert_pct));
  }

  // Categorías de gasto activas sin presupuesto (más la propia, al editar).
  const taken = new Set((ledger?.budgets ?? []).filter((b) => b.id !== id).map((b) => b.category_id));
  const options = (ledger?.categories ?? [])
    .filter((c) => c.scope === 'personal' && c.kind === 'expense' && !c.archived && !taken.has(c.id))
    .map((c) => ({ value: c.id, label: c.name, icon: c.icon, color: c.color }));

  async function save() {
    if (saving) return;
    let value: number;
    try {
      value = parseCOP(amount);
    } catch (e) {
      setErrors({ amount: (e as Error).message });
      return;
    }
    setSaving(true);
    try {
      // El umbral se valida en el dominio (entero 1–100); texto vacío o no numérico = NaN = error.
      const r = await saveBudget(db, { categoryId: categoryId ?? '', amount: value, alertPct: Number(alert.trim() || NaN) }, id);
      if (r.ok) {
        haptics.success();
        notify(id ? 'Presupuesto actualizado' : 'Presupuesto creado');
        router.back();
      } else setErrors(r.errors);
    } catch (e) {
      setErrors({ form: `No se pudo guardar: ${(e as Error).message}` });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (saving || !original) return;
    setSaving(true);
    try {
      const r = await deleteBudget(db, original.id);
      if (r.ok) {
        haptics.warning();
        router.back();
      } else setErrors({ form: r.error });
    } catch (e) {
      setErrors({ form: `No se pudo eliminar: ${(e as Error).message}` });
    } finally {
      setSaving(false);
    }
  }

  if (loadError || (id && ledger && !original)) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ThemedText style={styles.centerText} accessibilityRole="alert">
          {loadError ? `No se pudieron leer los datos: ${loadError}` : 'Este presupuesto ya no existe.'}
        </ThemedText>
        <PrimaryButton label="Volver" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <FormScroll contentStyle={styles.content}>
      {id ? <Stack.Screen options={{ title: 'Editar presupuesto' }} /> : null}
      {/* Nuevo: el teclado numérico se abre solo. Al editar, no. */}
      <View>
        <AmountField label="Monto mensual" value={amount} onChangeText={setAmount} error={errors.amount} autoFocus={!id} />
        <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
          Monto mensual. El mismo todos los meses; si lo cambias, cambia también en los meses anteriores.
        </ThemedText>
      </View>
      <CategoryGrid
        label="Categoría"
        options={options}
        value={categoryId}
        onChange={setCategoryId}
        error={errors.categoryId}
        empty="Todas las categorías de gasto ya tienen presupuesto."
      />
      <TextField
        label="Avisarme al llegar al (%)"
        value={alert}
        onChangeText={(t) => setAlert(t.replace(/\D/g, ''))}
        keyboardType="number-pad"
        maxLength={3}
        hint="Entre 1 y 100. Por defecto, 80 %."
        error={errors.alertPct}
      />
      {errors.form ? (
        <ThemedText type="small" style={{ color: theme.expense }} accessibilityRole="alert">{errors.form}</ThemedText>
      ) : null}
      <PrimaryButton label={id ? 'Guardar cambios' : 'Guardar presupuesto'} onPress={save} busy={saving || !ledger || (!!id && !filled)} />
      {original ? <PrimaryButton label="Eliminar presupuesto" onPress={() => setConfirming(true)} busy={saving} variant="danger" /> : null}
      <ConfirmDialog
        visible={confirming}
        title="¿Eliminar este presupuesto?"
        message="Los movimientos no cambian; solo deja de vigilarse esta categoría."
        confirmLabel="Eliminar"
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          remove();
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
