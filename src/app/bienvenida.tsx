import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Switch, View } from 'react-native';

import { ChipGroup, FormScroll, MoneyField, PrimaryButton, Segmented, TextField, type Option } from '@/components/form';
import { haptics } from '@/components/haptics';
import { ThemedText } from '@/components/themed-text';
import { createAccount, deleteChannel } from '@/db/ledger';
import { ACCOUNT_TYPE_LABEL, ACCOUNT_TYPES, type AccountErrors, type AccountType } from '@/domain/ledger';
import { parseCOP } from '@/domain/money';
import { normalizeStoreName, STORE_NAME_MAX, USER_NAME_MAX } from '@/domain/settings';
import { DEFAULT_CHANNELS } from '@/domain/store';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles } from '@/hooks/use-tokens';

const TYPES: Option<AccountType>[] = ACCOUNT_TYPES.map((t) => ({ value: t, label: ACCOUNT_TYPE_LABEL[t] }));
const STORE_OPTIONS: Option<'yes' | 'no'>[] = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Sí' },
];

/**
 * Primera vez que se abre la app (sin cuentas): nombre, ¿tienes una tienda? y primera cuenta. Todo se puede saltar;
 * al terminar o saltar no vuelve a salir (onboarding_done, propio de este teléfono).
 */
export default function WelcomeScreen() {
  const styles = useStyles();
  const db = useSQLiteContext();
  const theme = useTheme();
  const { save } = useSettings();
  const [step, setStep] = useState(0);
  const [userName, setUserName] = useState('');
  const [hasStore, setHasStore] = useState<'yes' | 'no'>('no');
  const [storeName, setStoreName] = useState('');
  const [channels, setChannels] = useState(() => new Set(DEFAULT_CHANNELS.map(([id]) => id)));
  const [accountName, setAccountName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [opening, setOpening] = useState('');
  const [errors, setErrors] = useState<AccountErrors & { form?: string; channels?: string }>({});
  const [saving, setSaving] = useState(false);

  /** Guarda lo elegido (con cuenta o sin ella) y entra a la app. */
  async function finish(withAccount: boolean) {
    if (saving) return;
    const store = hasStore === 'yes';
    let openingBalance = 0;
    if (withAccount) {
      try {
        openingBalance = opening.trim() === '' ? 0 : parseCOP(opening, { allowZero: true });
      } catch (e) {
        setErrors({ openingBalance: (e as Error).message });
        return;
      }
    }
    setSaving(true);
    try {
      if (withAccount) {
        const r = await createAccount(db, { name: accountName, type, openingBalance, allowNegative: false });
        if (!r.ok) {
          setErrors(r.errors);
          return;
        }
      }
      // Base nueva: los canales sugeridos aún no tienen ventas, así que los no elegidos se eliminan.
      if (store) for (const [id] of DEFAULT_CHANNELS) if (!channels.has(id)) await deleteChannel(db, id);
      const ok = await save({ userName, storeEnabled: store, ...(store ? { storeName: normalizeStoreName(storeName) } : {}), onboardingDone: true });
      if (!ok) {
        setErrors({ form: 'No se pudo guardar. Inténtalo de nuevo.' });
        return;
      }
      haptics.success();
      router.replace('/');
    } catch (e) {
      setErrors({ form: `No se pudo guardar: ${(e as Error).message}` });
    } finally {
      setSaving(false);
    }
  }

  function next() {
    if (step === 1 && hasStore === 'yes' && channels.size === 0) {
      setErrors({ channels: 'Elige al menos un canal (después puedes cambiarlos).' });
      return;
    }
    setErrors({});
    setStep(step + 1);
  }

  const skip = <PrimaryButton label="Saltar y empezar" onPress={() => finish(false)} busy={saving} variant="secondary" />;

  return (
    <FormScroll contentStyle={styles.content}>
      <ThemedText type="caption" themeColor="textSecondary" accessibilityLiveRegion="polite">Paso {step + 1} de 3</ThemedText>
      {step === 0 ? (
        <>
          <ThemedText type="title" accessibilityRole="header">Te damos la bienvenida</ThemedText>
          <ThemedText themeColor="textSecondary">Tus datos se quedan solo en este teléfono. Puedes cambiar todo esto después en Ajustes.</ThemedText>
          <TextField label="¿Cómo te llamas? (opcional)" value={userName} onChangeText={setUserName} placeholder="Para saludarte en el Inicio" maxLength={USER_NAME_MAX} autoFocus />
          <PrimaryButton label="Siguiente" onPress={next} busy={saving} />
          {skip}
        </>
      ) : step === 1 ? (
        <>
          <ThemedText type="title" accessibilityRole="header">¿Tienes una tienda o negocio?</ThemedText>
          <ThemedText themeColor="textSecondary">Si la tienes, verás una pestaña para registrar lo que inviertes y lo que vendes, separado de tus finanzas personales.</ThemedText>
          <Segmented label="Tienda o negocio" options={STORE_OPTIONS} value={hasStore} onChange={setHasStore} />
          {hasStore === 'yes' ? (
            <>
              <TextField label="Nombre de la tienda" value={storeName} onChangeText={setStoreName} placeholder="Ej.: Mi tienda" maxLength={STORE_NAME_MAX} />
              <View style={styles.channels} accessibilityRole="list">
                <ThemedText type="smallBold">Canales de venta</ThemedText>
                {DEFAULT_CHANNELS.map(([id, name]) => (
                  <View key={id} style={styles.switchRow}>
                    <ThemedText style={styles.flex}>{name}</ThemedText>
                    <Switch
                      value={channels.has(id)}
                      onValueChange={(on) => {
                        haptics.toggle(on);
                        const nextSet = new Set(channels);
                        if (on) nextSet.add(id);
                        else nextSet.delete(id);
                        setChannels(nextSet);
                      }}
                      accessibilityLabel={`Vendo por ${name}`}
                      trackColor={{ true: theme.primary, false: theme.track }}
                    />
                  </View>
                ))}
                {errors.channels ? (
                  <ThemedText type="small" style={{ color: theme.expense }} accessibilityRole="alert">{errors.channels}</ThemedText>
                ) : (
                  <ThemedText type="caption" themeColor="textSecondary">Puedes crear, renombrar y ordenar canales en Ajustes → Tienda.</ThemedText>
                )}
              </View>
            </>
          ) : null}
          <PrimaryButton label="Siguiente" onPress={next} busy={saving} />
          <PrimaryButton label="Atrás" onPress={() => setStep(0)} busy={saving} variant="secondary" />
        </>
      ) : (
        <>
          <ThemedText type="title" accessibilityRole="header">Tu primera cuenta</ThemedText>
          <ThemedText themeColor="textSecondary">Donde tienes tu dinero: un banco, efectivo, una billetera digital…</ThemedText>
          <TextField label="Nombre" value={accountName} onChangeText={setAccountName} placeholder="Ej.: Bancolombia" error={errors.name} maxLength={60} />
          <ChipGroup label="Tipo de cuenta" options={TYPES} value={type} onChange={setType} error={errors.type} />
          <MoneyField label="Saldo inicial" value={opening} placeholder="0" onChangeText={setOpening} hint="Lo que tiene hoy la cuenta. No cuenta como ingreso." error={errors.openingBalance} />
          {errors.form ? (
            <ThemedText type="small" style={{ color: theme.expense }} accessibilityRole="alert">{errors.form}</ThemedText>
          ) : null}
          <PrimaryButton label="Crear cuenta y empezar" onPress={() => finish(true)} busy={saving} />
          <PrimaryButton label="Lo hago después" onPress={() => finish(false)} busy={saving} variant="secondary" />
          <PrimaryButton label="Atrás" onPress={() => setStep(1)} busy={saving} variant="secondary" />
        </>
      )}
    </FormScroll>
  );
}

const useStyles = makeStyles((t) => ({
  content: { padding: t.space.three, gap: t.space.four, width: '100%', maxWidth: t.size.maxContent, alignSelf: 'center' },
  channels: { gap: t.space.two },
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: t.size.touch },
  flex: { flex: 1 },
}));
