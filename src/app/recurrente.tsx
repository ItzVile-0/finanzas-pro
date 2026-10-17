import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { View } from 'react-native';

import { CategoryGrid } from '@/components/category-icon';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { AccountCards, AmountField, CalendarField, FormScroll, PrimaryButton, Segmented, TextField } from '@/components/form';
import { haptics } from '@/components/haptics';
import { ACCOUNT_ICON } from '@/components/icon-circle';
import { HIDDEN_AMOUNT } from '@/components/movement-row';
import { ThemedText } from '@/components/themed-text';
import { useNotify } from '@/components/undo-toast';
import { deleteRecurring, saveRecurring, setRecurringActive, skipRecurring } from '@/db/ledger';
import { rescheduleNotifications } from '@/db/notifications';
import { addDays, formatLongDate, formatShortDate, todayLocal } from '@/domain/dates';
import { accountBalances } from '@/domain/ledger';
import { formatCOP, formatCOPInput, parseCOP } from '@/domain/money';
import { followingDue, FREQUENCIES, FREQUENCY_LABEL, toBiweeklyDate, type Frequency, type RecurringErrors } from '@/domain/recurring';
import { useLedger } from '@/hooks/use-ledger';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles } from '@/hooks/use-tokens';

/** Crear (sin id) o editar (?id=) un pago recurrente de gasto personal. Al editar: pagar, omitir, pausar y eliminar. */
export default function RecurringScreen() {
  const styles = useStyles();
  const db = useSQLiteContext();
  const notify = useNotify();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { ledger, error: loadError } = useLedger();
  const { settings } = useSettings();
  const original = id ? ledger?.recurring.find((r) => r.id === id) : undefined;
  const today = todayLocal();
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [date, setDate] = useState(today);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [errors, setErrors] = useState<RecurringErrors & { form?: string }>({});
  const [saving, setSaving] = useState(false);
  // Candado síncrono: dos toques seguidos llegan antes de que `saving` se pinte; sin él habría doble cambio.
  const lock = useRef(false);
  const [confirming, setConfirming] = useState<'skip' | 'delete' | null>(null);
  // Pagar, Omitir o Pausar/Reanudar con cambios sin guardar: primero se pregunta qué hacer con ellos.
  type Next = 'pay' | 'skip' | 'toggle';
  const [unsaved, setUnsaved] = useState<Next | null>(null);
  const [filled, setFilled] = useState(false);
  // Lo último guardado (para saber si hay cambios) y el ancla vigente (guardar la reinicia a la fecha elegida).
  const snapshot = JSON.stringify([amount, concept, frequency, date, accountId, categoryId]);
  const [baseline, setBaseline] = useState<string | null>(null);
  const [anchor, setAnchor] = useState('');
  const dirty = baseline !== null && snapshot !== baseline;
  if (original && !filled) {
    setFilled(true);
    setBaseline(
      JSON.stringify([
        formatCOPInput(String(original.estimated_amount)), original.concept, original.frequency,
        original.next_due_date, original.account_id, original.category_id,
      ]),
    );
    setAnchor(original.anchor_date);
    setAmount(formatCOPInput(String(original.estimated_amount)));
    setConcept(original.concept);
    setFrequency(original.frequency);
    setDate(original.next_due_date);
    setAccountId(original.account_id);
    setCategoryId(original.category_id);
  }
  // Nuevo: la primera cuenta personal activa.
  if (!id && ledger && !filled) {
    setFilled(true);
    setAccountId(ledger.accounts.find((a) => a.scope === 'personal' && !a.archived)?.id ?? null);
  }

  const balances = ledger ? accountBalances(ledger.accounts, ledger.transactions) : new Map<string, number>();
  // Las archivadas no se ofrecen, salvo la que ya tenía (validateRecurring la rechaza: hay que elegir otra).
  const accountOptions = (ledger?.accounts ?? [])
    .filter((a) => a.scope === 'personal' && (!a.archived || a.id === original?.account_id))
    .map((a) => ({
      value: a.id,
      label: a.name,
      icon: ACCOUNT_ICON[a.type],
      balance: settings.hideAmounts ? HIDDEN_AMOUNT : formatCOP(balances.get(a.id) ?? 0),
    }));
  const categoryOptions = (ledger?.categories ?? [])
    .filter((c) => c.scope === 'personal' && c.kind === 'expense' && (!c.archived || c.id === original?.category_id))
    .map((c) => ({ value: c.id, label: c.name, icon: c.icon, color: c.color }));

  // Quincenal: solo el 15 o el último día del mes; la fecha se ajusta sola.
  const fitDate = (iso: string, f: Frequency) => (f === 'biweekly' ? toBiweeklyDate(iso) : iso);

  /** true si quedó guardado. */
  async function save(): Promise<boolean> {
    if (lock.current) return false;
    let value: number;
    try {
      value = parseCOP(amount);
    } catch (e) {
      setErrors({ estimatedAmount: (e as Error).message });
      return false;
    }
    lock.current = true;
    setSaving(true);
    try {
      const r = await saveRecurring(
        db,
        { concept, estimatedAmount: value, frequency, firstDate: date, accountId: accountId ?? '', categoryId: categoryId ?? '' },
        id,
      );
      if (!r.ok) {
        setErrors(r.errors);
        return false;
      }
      haptics.success();
      void rescheduleNotifications(db); // fechas o monto nuevos en los avisos
      setErrors({});
      setBaseline(snapshot);
      setAnchor(date);
      return true;
    } catch (e) {
      setErrors({ form: `No se pudo guardar: ${(e as Error).message}` });
      return false;
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  const pay = () => original && router.replace({ pathname: '/movimiento-nuevo', params: { recurrente: original.id } });
  // Pausar/Reanudar vuelve atrás: la pantalla anterior se recarga al ganar el foco y muestra el estado nuevo.
  const toggle = () =>
    original &&
    act(
      () => setRecurringActive(db, original.id, !original.active),
      () => {
        haptics.success();
        notify(original.active ? 'Pago pausado' : 'Pago reanudado');
        router.back();
      },
    );
  const proceed = (next: Next) => (next === 'pay' ? pay() : next === 'skip' ? setConfirming('skip') : toggle());
  const ask = (next: Next) => (dirty ? setUnsaved(next) : proceed(next));

  /** Omitir, pausar/reanudar o eliminar: todas vuelven a la lista al terminar. */
  async function act(run: () => Promise<{ ok: true } | { ok: false; error: string }>, done: () => void) {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    try {
      const r = await run();
      if (r.ok) {
        void rescheduleNotifications(db); // omitir, pausar o eliminar cambia los vencimientos avisados
        done();
      } else setErrors({ form: r.error });
    } catch (e) {
      setErrors({ form: `No se pudo completar: ${(e as Error).message}` });
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  if (loadError || (id && ledger && !original)) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ThemedText style={styles.centerText} accessibilityRole="alert">
          {loadError ? `No se pudieron leer los datos: ${loadError}` : 'Este pago recurrente ya no existe.'}
        </ThemedText>
        <PrimaryButton label="Volver" onPress={() => router.back()} />
      </View>
    );
  }

  // Omitir solo se confirma sin cambios pendientes: fecha y frecuencia del formulario = las guardadas.
  const nextAfterSkip = original && anchor ? followingDue(anchor, date, frequency) : null;

  return (
    <FormScroll contentStyle={styles.content}>
      {id ? <Stack.Screen options={{ title: 'Editar pago recurrente' }} /> : null}
      {/* Nuevo: el teclado numérico se abre solo. Al editar, no. */}
      <View>
        <AmountField label="Monto estimado" value={amount} onChangeText={setAmount} error={errors.estimatedAmount} autoFocus={!id} />
        <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
          Monto estimado. Al pagar escribes el valor real de esa cuota.
        </ThemedText>
      </View>
      <TextField label="Concepto" value={concept} onChangeText={setConcept} placeholder="Ej.: Arriendo" maxLength={60} error={errors.concept} />
      <Segmented
        label="Frecuencia"
        options={FREQUENCIES.map((f) => ({ value: f, label: FREQUENCY_LABEL[f] }))}
        value={frequency}
        onChange={(f) => {
          setFrequency(f);
          setDate(fitDate(date, f));
        }}
        error={errors.frequency}
        hint={frequency === 'biweekly' ? 'Quincenal: el 15 y el último día de cada mes.' : undefined}
      />
      <CalendarField
        label={id ? 'Próxima cuota' : 'Primera cuota'}
        value={date}
        onChange={(iso) => setDate(fitDate(iso, frequency))}
        max={addDays(today, 366)}
        error={errors.firstDate}
      />
      <CategoryGrid label="Categoría" options={categoryOptions} value={categoryId} onChange={setCategoryId} error={errors.categoryId} />
      <AccountCards
        label="Cuenta de pago"
        options={accountOptions}
        value={accountId}
        onChange={setAccountId}
        error={errors.accountId}
        empty="No hay cuentas personales."
      />
      {errors.form ? (
        <ThemedText type="small" style={{ color: theme.expense }} accessibilityRole="alert">{errors.form}</ThemedText>
      ) : null}
      {/* Edición: Pagar es la acción destacada (único botón relleno); Guardar solo con cambios. Pausado: Guardar va relleno. */}
      {original?.active ? (
        <PrimaryButton label={`Pagar cuota del ${formatShortDate(original.next_due_date)}`} onPress={() => ask('pay')} busy={saving} />
      ) : null}
      {original ? (
        <View style={styles.pair}>
          {original.active ? (
            <View style={styles.flex}>
              <PrimaryButton label="Omitir cuota" onPress={() => ask('skip')} busy={saving} variant="secondary" />
            </View>
          ) : null}
          <View style={styles.flex}>
            <PrimaryButton label={original.active ? 'Pausar' : 'Reanudar'} onPress={() => ask('toggle')} busy={saving} variant="secondary" />
          </View>
        </View>
      ) : null}
      <PrimaryButton
        label={id ? 'Guardar cambios' : 'Guardar pago recurrente'}
        onPress={async () => (await save()) && router.back()}
        busy={saving || !ledger || !filled}
        disabled={!!original && !dirty}
        variant={original?.active ? 'secondary' : 'primary'}
      />
      {original ? <PrimaryButton label="Eliminar pago recurrente" onPress={() => setConfirming('delete')} busy={saving} variant="danger" /> : null}
      <ConfirmDialog
        visible={confirming === 'skip'}
        title="¿Omitir esta cuota?"
        message={
          nextAfterSkip
            ? `No se registra ningún gasto por la cuota del ${formatLongDate(date)}. La próxima será el ${formatLongDate(nextAfterSkip)}.`
            : ''
        }
        confirmLabel="Omitir"
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          setConfirming(null);
          if (original)
            act(
              () => skipRecurring(db, original.id),
              () => {
                haptics.success();
                notify('Cuota omitida');
                router.back();
              },
            );
        }}
      />
      <ConfirmDialog
        visible={unsaved !== null}
        title="Cambios sin guardar"
        message="Tienes cambios sin guardar. ¿Guardarlos antes de continuar?"
        confirmLabel="Guardar y continuar"
        otherLabel="Descartar"
        onCancel={() => setUnsaved(null)}
        onOther={() => {
          const next = unsaved;
          setUnsaved(null);
          if (!next || baseline === null) return;
          // Descartar: el formulario vuelve a lo último guardado y sigue con lo que se pidió.
          const [a, c, f, d, acc, cat] = JSON.parse(baseline) as [string, string, Frequency, string, string | null, string | null];
          setAmount(a);
          setConcept(c);
          setFrequency(f);
          setDate(d);
          setAccountId(acc);
          setCategoryId(cat);
          setErrors({});
          proceed(next);
        }}
        onConfirm={async () => {
          const next = unsaved;
          setUnsaved(null);
          if (next && (await save())) proceed(next);
        }}
      />
      <ConfirmDialog
        visible={confirming === 'delete'}
        title="¿Eliminar este pago recurrente?"
        message="Los gastos que ya pagaste se conservan; solo deja de programarse."
        confirmLabel="Eliminar"
        destructive
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          setConfirming(null);
          if (original)
            act(
              () => deleteRecurring(db, original.id),
              () => {
                haptics.warning();
                router.back();
              },
            );
        }}
      />
    </FormScroll>
  );
}

const useStyles = makeStyles((t) => ({
  content: { padding: t.space.three, gap: t.space.four, width: '100%', maxWidth: t.size.maxContent, alignSelf: 'center' },
  center: { flex: 1, padding: t.space.four, gap: t.space.three, justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  pair: { flexDirection: 'row', gap: t.space.two },
  flex: { flex: 1 },
}));
