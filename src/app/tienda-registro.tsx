import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { View } from 'react-native';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { AccountCards, AmountField, ChipGroup, DateField, FormScroll, PrimaryButton, TextField } from '@/components/form';
import { haptics } from '@/components/haptics';
import { ACCOUNT_ICON } from '@/components/icon-circle';
import { HIDDEN_AMOUNT } from '@/components/movement-row';
import { ThemedText } from '@/components/themed-text';
import { useNotify, useUndo } from '@/components/undo-toast';
import { deleteMovement, restoreMovement, saveRecord } from '@/db/ledger';
import { todayLocal } from '@/domain/dates';
import { recordTypeOf, type RecordErrors, type RecordType } from '@/domain/store';
import { accountBalances } from '@/domain/ledger';
import { formatCOP, formatCOPInput, parseCOP } from '@/domain/money';
import { useLedger } from '@/hooks/use-ledger';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles } from '@/hooks/use-tokens';

const TEXT: Record<RecordType, { title: string; edit: string; amount: string; account: string; placeholder: string }> = {
  investment: { title: 'Nueva inversión', edit: 'Editar inversión', amount: 'Valor invertido', account: 'Sale de', placeholder: 'Ej.: Mercancía de octubre' },
  sale: { title: 'Nueva venta', edit: 'Editar venta', amount: 'Valor de la venta', account: 'Entra a', placeholder: 'Ej.: Body negro talla M' },
};

/** Inversión o venta de la tienda: nueva (?tipo=investment|sale) o editar (?id=). El tipo no cambia al editar. */
export default function StoreRecordScreen() {
  const styles = useStyles();
  const db = useSQLiteContext();
  const notify = useNotify();
  const showUndo = useUndo();
  const theme = useTheme();
  const { settings, loaded, save: saveSetting } = useSettings();
  const { tipo, id } = useLocalSearchParams<{ tipo?: string; id?: string }>();
  const { ledger, error: loadError } = useLedger();
  const original = id ? ledger?.transactions.find((t) => t.id === id) : undefined;
  const type: RecordType = (original ? recordTypeOf(original) : null) ?? (tipo === 'sale' ? 'sale' : 'investment');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayLocal);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [channel, setChannel] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<RecordErrors & { form?: string }>({});
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [filled, setFilled] = useState(false);

  if (ledger && loaded && !filled) {
    setFilled(true);
    if (original) {
      setAmount(formatCOPInput(String(original.amount)));
      setDate(original.date);
      setAccountId(original.account_id);
      setChannel(original.channel_id ?? null);
      setNote(original.note);
    } else {
      // Registro rápido: la cuenta del último registro del mismo tipo; si no hay o está archivada, la primera activa.
      const active = ledger.accounts.filter((a) => !a.archived);
      const last = ledger.transactions.find((t) => recordTypeOf(t) === type);
      setAccountId((active.find((a) => a.id === last?.account_id) ?? active[0])?.id ?? null);
      // El canal de la última venta si sigue activo; si no, ninguno (se elige).
      if (type === 'sale') setChannel(ledger.channels.find((c) => c.id === settings.lastChannel && !c.archived)?.id ?? null);
    }
  }

  // Activos y, al editar, el archivado que ya tenía (como las cuentas).
  const channels = (ledger?.channels ?? []).filter((c) => !c.archived || c.id === original?.channel_id);
  const balances = ledger ? accountBalances(ledger.accounts, ledger.transactions) : new Map<string, number>();
  const accounts = (ledger?.accounts ?? [])
    .filter((a) => !a.archived || a.id === original?.account_id)
    .map((a) => ({
      value: a.id,
      label: a.name,
      icon: ACCOUNT_ICON[a.type],
      balance: settings.hideAmounts ? HIDDEN_AMOUNT : formatCOP(balances.get(a.id) ?? 0),
    }));

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
      const r = await saveRecord(db, { type, amount: value, date, accountId: accountId ?? '', channel: type === 'sale' ? channel : null, note }, original?.id);
      if (r.ok) {
        // Recordar el canal para la próxima venta. Es una comodidad: si no se guarda, la venta ya está.
        if (type === 'sale' && !original && channel) void saveSetting({ lastChannel: channel });
        haptics.success();
        notify(`${type === 'sale' ? 'Venta' : 'Inversión'} ${original ? 'actualizada' : 'guardada'}`);
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
      const r = await deleteMovement(db, original.id);
      if (r.ok) {
        haptics.warning();
        const { deleted } = r;
        showUndo({
          message: type === 'sale' ? 'Venta eliminada' : 'Inversión eliminada',
          undo: async () => {
            const back = await restoreMovement(db, deleted);
            return back.ok ? null : back.error;
          },
        });
        router.back();
      } else setErrors({ form: r.error });
    } catch (e) {
      setErrors({ form: `No se pudo eliminar: ${(e as Error).message}` });
    } finally {
      setSaving(false);
    }
  }

  if (loadError || (id && ledger && (!original || !recordTypeOf(original)))) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ThemedText style={styles.centerText} accessibilityRole="alert">
          {loadError ? `No se pudieron leer los datos: ${loadError}` : 'Este registro ya no existe.'}
        </ThemedText>
        <PrimaryButton label="Volver" onPress={() => router.back()} />
      </View>
    );
  }

  const t = TEXT[type];
  return (
    <FormScroll contentStyle={styles.content}>
      <Stack.Screen options={{ title: original ? t.edit : t.title }} />
      <AmountField label={t.amount} value={amount} onChangeText={setAmount} error={errors.amount} autoFocus={!id} />
      {type === 'sale' ? (
        <ChipGroup
          label="Canal"
          options={channels.map((c) => ({ value: c.id, label: c.name }))}
          value={channel}
          onChange={setChannel}
          error={errors.channel}
          empty="No hay canales activos: agrega uno en Ajustes → Tienda."
        />
      ) : null}
      <AccountCards label={t.account} options={accounts} value={accountId} onChange={setAccountId} error={errors.accountId} empty="Primero crea una cuenta." />
      <DateField value={date} onChange={setDate} error={errors.date} />
      <TextField label="Descripción (opcional)" value={note} onChangeText={setNote} placeholder={t.placeholder} error={errors.note} maxLength={200} />
      {errors.form || errors.type ? (
        <ThemedText type="small" style={{ color: theme.expense }} accessibilityRole="alert">{errors.form ?? errors.type}</ThemedText>
      ) : null}
      <PrimaryButton label={original ? 'Guardar cambios' : type === 'sale' ? 'Guardar venta' : 'Guardar inversión'} onPress={save} busy={saving || !ledger || !filled} />
      {original ? <PrimaryButton label={type === 'sale' ? 'Eliminar venta' : 'Eliminar inversión'} onPress={() => setConfirming(true)} busy={saving} variant="danger" /> : null}
      <ConfirmDialog
        visible={confirming}
        title={type === 'sale' ? '¿Eliminar esta venta?' : '¿Eliminar esta inversión?'}
        message="El saldo de la cuenta y la ganancia se recalculan. No se puede deshacer."
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
