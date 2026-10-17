import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Switch, View } from 'react-native';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { haptics } from '@/components/haptics';
import { ChipGroup, Field, MoneyField, PrimaryButton, TextField, type Option, FormScroll } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { useNotify } from '@/components/undo-toast';
import { createAccount, deleteAccount, setAccountArchived, updateAccount } from '@/db/ledger';
import { ACCOUNT_TYPE_LABEL, ACCOUNT_TYPES, canDeleteAccount, type AccountErrors, type AccountType } from '@/domain/ledger';
import { formatCOPInput, parseCOP } from '@/domain/money';
import { useLedger } from '@/hooks/use-ledger';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles } from '@/hooks/use-tokens';

const TYPES: Option<AccountType>[] = ACCOUNT_TYPES.map((t) => ({ value: t, label: ACCOUNT_TYPE_LABEL[t] }));

export default function NewAccountScreen() {
  const styles = useStyles();
  const db = useSQLiteContext();
  const notify = useNotify();
  const theme = useTheme();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [opening, setOpening] = useState('');
  const [allowNegative, setAllowNegative] = useState(false);
  const [errors, setErrors] = useState<AccountErrors & { form?: string }>({});
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Con ?id= la pantalla edita esa cuenta: se rellena una sola vez cuando carga el libro.
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { ledger, error: loadError } = useLedger();
  const original = id ? ledger?.accounts.find((a) => a.id === id) : undefined;
  const [filled, setFilled] = useState(false);
  if (original && !filled) {
    setFilled(true);
    setName(original.name);
    setType(original.type);
    setOpening(formatCOPInput(String(original.opening_balance)));
    setAllowNegative(original.allow_negative);
  }
  const waiting = !!id && !filled;

  async function save() {
    if (saving) return;
    let openingBalance: number;
    try {
      // Vacío = 0 (el placeholder ya muestra 0).
      openingBalance = opening.trim() === '' ? 0 : parseCOP(opening, { allowZero: true });
    } catch (e) {
      setErrors({ openingBalance: (e as Error).message });
      return;
    }
    setSaving(true);
    try {
      const input = { name, type, openingBalance, allowNegative };
      const r = original ? await updateAccount(db, original.id, input) : await createAccount(db, input);
      if (r.ok) {
        haptics.success();
        notify(original ? 'Cuenta actualizada' : 'Cuenta creada');
        router.back();
      }
      else setErrors(r.errors);
    } catch (e) {
      setErrors({ form: `No se pudo guardar: ${(e as Error).message}` });
    } finally {
      setSaving(false);
    }
  }

  /** Archivar, desarchivar o eliminar: si el dominio lo rechaza, el motivo queda junto a los botones. */
  async function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, feel: 'success' | 'warning' = 'success') {
    if (saving) return;
    setSaving(true);
    try {
      const r = await action();
      if (r.ok) {
        haptics[feel]();
        router.back();
      }
      else setErrors({ form: r.error });
    } catch (e) {
      setErrors({ form: `No se pudo completar: ${(e as Error).message}` });
    } finally {
      setSaving(false);
    }
  }


  if (loadError || (id && ledger && !original)) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ThemedText style={styles.centerText} accessibilityRole="alert">
          {loadError ? `No se pudieron leer los datos: ${loadError}` : 'Esta cuenta ya no existe.'}
        </ThemedText>
        <PrimaryButton label="Volver" onPress={() => router.back()} />
      </View>
    );
  }

  const deletable = original && ledger && canDeleteAccount(original.id, ledger.transactions) === null;

  return (
    <FormScroll contentStyle={styles.content}>
      {id ? <Stack.Screen options={{ title: 'Editar cuenta' }} /> : null}
      {original?.archived ? (
        <ThemedText type="small" themeColor="textSecondary">Archivada: no aparece en los formularios ni en el saldo total.</ThemedText>
      ) : null}
      <TextField label="Nombre" value={name} onChangeText={setName} placeholder="Ej.: Bancolombia" error={errors.name} maxLength={60} />
      <ChipGroup label="Tipo de cuenta" options={TYPES} value={type} onChange={setType} error={errors.type} />
      <MoneyField
        label="Saldo inicial"
        value={opening}
        placeholder="0"
        onChangeText={setOpening}
        hint={id ? 'Corregirlo recalcula todos los saldos de la cuenta.' : 'Lo que tiene hoy la cuenta. No cuenta como ingreso.'}
        error={errors.openingBalance}
      />
      <Field
        label="Permitir saldo negativo"
        hint="Solo para cuentas que pueden quedar en rojo, como una tarjeta de crédito."
        error={errors.allowNegative}>
        <View style={styles.switchRow}>
          <ThemedText style={styles.flex}>{allowNegative ? 'Sí' : 'No'}</ThemedText>
          <Switch
            value={allowNegative}
            onValueChange={(on) => {
              haptics.toggle(on);
              setAllowNegative(on);
            }}
            accessibilityLabel="Permitir saldo negativo"
            trackColor={{ true: theme.primary, false: theme.track }}
          />
        </View>
      </Field>
      {errors.form ? (
        <ThemedText type="small" style={{ color: theme.expense }} accessibilityRole="alert">{errors.form}</ThemedText>
      ) : null}
      <PrimaryButton label={id ? 'Guardar cambios' : 'Guardar cuenta'} onPress={save} busy={saving || waiting} />
      {original ? (
        <PrimaryButton
          label={original.archived ? 'Desarchivar cuenta' : 'Archivar cuenta'}
          onPress={() => run(() => setAccountArchived(db, original.id, !original.archived))}
          busy={saving}
          variant="secondary"
        />
      ) : null}
      {deletable ? <PrimaryButton label="Eliminar cuenta" onPress={() => setConfirming(true)} busy={saving} variant="danger" /> : null}
      <ConfirmDialog
        visible={confirming}
        title="¿Eliminar esta cuenta?"
        message="No tiene movimientos. No se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          if (original) run(() => deleteAccount(db, original.id), 'warning');
        }}
      />
    </FormScroll>
  );
}

const useStyles = makeStyles((t) => ({
  content: { padding: t.space.three, gap: t.space.four, width: '100%', maxWidth: t.size.maxContent, alignSelf: 'center' },
  center: { flex: 1, padding: t.space.four, gap: t.space.three, justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
}));
