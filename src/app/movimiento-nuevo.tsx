import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { View } from 'react-native';

import { CategoryGrid } from '@/components/category-icon';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { AccountCards, AmountField, DateField, PrimaryButton, Segmented, TextField, FormScroll } from '@/components/form';
import { ACCOUNT_ICON } from '@/components/icon-circle';
import { haptics } from '@/components/haptics';
import { HIDDEN_AMOUNT } from '@/components/movement-row';
import { ThemedText } from '@/components/themed-text';
import { useNotify, useUndo } from '@/components/undo-toast';
import { confirmRecurring, deleteMovement, restoreMovement, saveMovement, updateMovement } from '@/db/ledger';
import { rescheduleNotifications } from '@/db/notifications';
import { formatShortDate, todayLocal } from '@/domain/dates';
import {
  accountBalances,
  CHANGE_KIND,
  PAYROLL_CATEGORY_ID,
  type Account,
  type MovementErrors,
  type MovementKind,
} from '@/domain/ledger';
import { formatCOP, formatCOPInput, parseCOP } from '@/domain/money';
import { useLedger } from '@/hooks/use-ledger';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles } from '@/hooks/use-tokens';

// Movimientos personales. La inversión y la venta de la tienda se registran en su pestaña.
const KINDS: { value: MovementKind; label: string }[] = [
  { value: 'expense', label: 'Gasto' },
  { value: 'income', label: 'Ingreso' },
  { value: 'transfer', label: 'Transferencia' },
];

// Las archivadas no se ofrecen, salvo la que ya tenía el movimiento que se edita (`keep`).
const usableAccounts = (accounts: Account[], exclude?: string | null, keep?: string | null) =>
  accounts.filter((a) => (!a.archived || a.id === keep) && a.id !== exclude);

export default function NewMovementScreen() {
  const styles = useStyles();
  const db = useSQLiteContext();
  const notify = useNotify();
  const showUndo = useUndo();
  const theme = useTheme();
  const { ledger, error: loadError } = useLedger();
  const [kind, setKind] = useState<MovementKind>('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayLocal);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<MovementErrors & { form?: string }>({});
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { settings, loaded: settingsLoaded, save: saveSetting } = useSettings();

  // Con ?id= la pantalla edita ese movimiento: se rellena una sola vez cuando carga el libro.
  // Con ?recurrente= paga la cuota de esa plantilla: gasto prellenado con el monto estimado (editable).
  const { id, recurrente } = useLocalSearchParams<{ id?: string; recurrente?: string }>();
  const original = id ? ledger?.transactions.find((t) => t.id === id) : undefined;
  const paying = recurrente ? ledger?.recurring.find((r) => r.id === recurrente) : undefined;
  const [filled, setFilled] = useState(false);
  if (original && !filled) {
    setFilled(true);
    setKind(original.kind);
    setAmount(formatCOPInput(String(original.amount)));
    setDate(original.date);
    setAccountId(original.account_id);
    setToAccountId(original.to_account_id);
    setCategoryId(original.category_id);
    setNote(original.note);
  }
  if (paying && !filled) {
    setFilled(true);
    setAmount(formatCOPInput(String(paying.estimated_amount)));
    setAccountId(paying.account_id);
    setCategoryId(paying.category_id);
    setNote(paying.concept);
  }

  const hasTo = kind === 'transfer';
  const accounts = ledger?.accounts ?? [];

  // Registro rápido: la última cuenta usada para ese tipo; si ya no existe o está archivada, la primera disponible.
  const pick = (list: Account[], preferred?: string | null) => (list.find((a) => a.id === preferred) ?? list[0])?.id ?? null;
  function defaultsFor(k: MovementKind) {
    const last = settings.lastAccounts[k];
    const from = pick(usableAccounts(accounts), last?.from);
    return { from, to: k === 'transfer' ? pick(usableAccounts(accounts, from), last?.to) : null };
  }
  // Nuevo (no al editar): se preseleccionan una sola vez, cuando cargan el libro y los ajustes.
  if (!id && !recurrente && ledger && settingsLoaded && !filled) {
    setFilled(true);
    const d = defaultsFor(kind);
    setAccountId(d.from);
    setToAccountId(d.to);
  }
  const balances = ledger ? accountBalances(ledger.accounts, ledger.transactions) : new Map<string, number>();
  const cards = (list: Account[]) =>
    list.map((a) => ({
      value: a.id,
      label: a.name,
      icon: ACCOUNT_ICON[a.type],
      balance: settings.hideAmounts ? HIDDEN_AMOUNT : formatCOP(balances.get(a.id) ?? 0),
    }));
  const fromOptions = cards(usableAccounts(accounts, null, original?.account_id));
  const toOptions = hasTo ? cards(usableAccounts(accounts, accountId, original?.to_account_id)) : [];
  // Nómina primero en los ingresos; el resto en su orden.
  const categoryOptions =
    kind === 'income' || kind === 'expense'
      ? (ledger?.categories ?? [])
          .filter((c) => c.scope === 'personal' && c.kind === kind && (!c.archived || c.id === original?.category_id))
          .sort((a, b) => Number(b.id === PAYROLL_CATEGORY_ID) - Number(a.id === PAYROLL_CATEGORY_ID))
          .map((c) => ({ value: c.id, label: c.name, icon: c.icon, color: c.color }))
      : [];

  /** Si el origen nuevo era el destino, el destino pasa a otra cuenta disponible. */
  function chooseFrom(v: string) {
    setAccountId(v);
    if (hasTo && v === toAccountId) setToAccountId(pick(usableAccounts(accounts, v)));
  }

  function changeKind(k: MovementKind) {
    setKind(k);
    const d = defaultsFor(k);
    setAccountId(d.from);
    setToAccountId(d.to);
    setCategoryId(null);
    setErrors({});
  }

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
      const input = {
        kind,
        amount: value,
        date,
        accountId: accountId ?? '',
        toAccountId: hasTo ? toAccountId : null,
        categoryId: hasTo ? null : categoryId,
        note,
      };
      const r = original
        ? await updateMovement(db, original.id, input)
        : paying
          ? await confirmRecurring(db, paying.id, input)
          : await saveMovement(db, input);
      if (r.ok && !original && !paying) {
        // Recordar las cuentas para el próximo registro. Es una comodidad: si no se guarda, el movimiento ya está.
        void saveSetting({ lastAccounts: { ...settings.lastAccounts, [kind]: { from: input.accountId, to: input.toAccountId } } });
      }
      if (r.ok) {
        if (paying) void rescheduleNotifications(db); // la cuota pagada ya no se avisa
        haptics.success();
        notify(original ? 'Movimiento actualizado' : paying ? 'Pago registrado' : 'Movimiento guardado');
        router.back();
      }
      else setErrors(r.errors);
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
          message: 'Movimiento eliminado',
          undo: async () => {
            const back = await restoreMovement(db, deleted);
            return back.ok ? null : back.error;
          },
        });
        router.back();
      }
      else setErrors({ form: r.error });
    } catch (e) {
      setErrors({ form: `No se pudo eliminar: ${(e as Error).message}` });
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ThemedText style={{ color: theme.expense }} accessibilityRole="alert">No se pudieron leer los datos: {loadError}</ThemedText>
      </View>
    );
  }

  if (id && ledger && !original) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ThemedText style={styles.centerText} accessibilityRole="alert">Este movimiento ya no existe.</ThemedText>
        <PrimaryButton label="Volver" onPress={() => router.back()} />
      </View>
    );
  }

  if (recurrente && ledger && !paying?.active) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ThemedText style={styles.centerText} accessibilityRole="alert">
          {paying ? 'Este pago recurrente está pausado: reanúdalo para pagarlo.' : 'Este pago recurrente ya no existe.'}
        </ThemedText>
        <PrimaryButton label="Volver" onPress={() => router.back()} />
      </View>
    );
  }

  if (ledger && !accounts.some((a) => !a.archived)) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ThemedText style={styles.centerText}>Primero crea una cuenta.</ThemedText>
        <PrimaryButton label="Crear cuenta" onPress={() => router.replace('/cuenta-nueva')} />
      </View>
    );
  }

  const fromLabel = kind === 'income' ? 'Cuenta que recibe' : 'Cuenta de origen';

  return (
    <FormScroll contentStyle={styles.content}>
      {id ? <Stack.Screen options={{ title: 'Editar movimiento' }} /> : null}
      {paying ? <Stack.Screen options={{ title: `Pagar ${paying.concept}` }} /> : null}
      {/* Nuevo: el teclado numérico se abre solo. Al editar, no. */}
      <View>
        <AmountField value={amount} onChangeText={setAmount} error={errors.amount} autoFocus={!id} />
        {paying ? (
          <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
            Cuota del {formatShortDate(paying.next_due_date)} · estimado {formatCOP(paying.estimated_amount)}. Escribe el valor real.
          </ThemedText>
        ) : null}
      </View>
      <Segmented
        label="Tipo"
        options={KINDS.map((k) => ({ ...k, disabled: !!id || !!paying }))}
        value={kind}
        onChange={changeKind}
        error={errors.kind}
        hint={id ? CHANGE_KIND : undefined}
      />
      {hasTo ? null : (
        <CategoryGrid label="Categoría" options={categoryOptions} value={categoryId} onChange={setCategoryId} error={errors.categoryId} />
      )}
      <AccountCards label={fromLabel} options={fromOptions} value={accountId} onChange={chooseFrom} error={errors.accountId} empty="No hay cuentas." />
      {hasTo ? (
        <AccountCards label="Cuenta destino" options={toOptions} value={toAccountId} onChange={setToAccountId} error={errors.toAccountId} empty="No hay otra cuenta." />
      ) : null}
      <DateField value={date} onChange={setDate} error={errors.date} />
      <TextField label="Nota (opcional)" value={note} onChangeText={setNote} error={errors.note} maxLength={200} />
      {errors.form ? (
        <ThemedText type="small" style={{ color: theme.expense }} accessibilityRole="alert">{errors.form}</ThemedText>
      ) : null}
      <PrimaryButton
        label={id ? 'Guardar cambios' : paying ? 'Registrar pago' : 'Guardar movimiento'}
        onPress={save}
        busy={saving || !ledger || ((!!id || !!paying) && !filled)}
      />
      {id ? <PrimaryButton label="Eliminar movimiento" onPress={() => setConfirming(true)} busy={saving || !filled} variant="danger" /> : null}
      <ConfirmDialog
        visible={confirming}
        title="¿Eliminar este movimiento?"
        message="Los saldos se recalculan. No se puede deshacer."
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
