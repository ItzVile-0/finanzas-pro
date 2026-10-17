import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Linking, Switch, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ChipGroup, FormScroll, PrimaryButton } from '@/components/form';
import { haptics } from '@/components/haptics';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { notificationsAvailable, requestNotificationPermission, rescheduleNotifications, sendTestNotification } from '@/db/notifications';
import { NOTIFY_KINDS, type NotificationPrefs, type NotifyKind } from '@/domain/notifications';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles } from '@/hooks/use-tokens';

const TEXT: Record<NotifyKind, { title: string; hint: string }> = {
  recurring: { title: 'Pagos recurrentes', hint: 'El día antes y el día del vencimiento' },
  daily: { title: 'Registrar gastos', hint: 'Un recordatorio todos los días' },
  backup: { title: 'Copia de seguridad', hint: 'Si pasaron más de 7 días sin exportar una copia' },
  weekly: { title: 'Resumen semanal', hint: 'Los domingos, con tu semana de lunes a domingo' },
};
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

/** Ajustes → Notificaciones: avisos locales de este teléfono (no viajan en la copia). El permiso se pide al encender el primero. */
export default function NotificationsScreen() {
  const styles = useStyles();
  const db = useSQLiteContext();
  const theme = useTheme();
  const { settings, loaded, error, save } = useSettings();
  const [denied, setDenied] = useState(false);
  const [editingTime, setEditingTime] = useState<NotifyKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const prefs = settings.notifications;
  // En Expo Go la librería no existe: se ve todo, pero nada se puede encender.
  const available = notificationsAvailable();
  const off = !loaded || busy || !available;

  async function update(next: NotificationPrefs) {
    if (await save({ notifications: next })) await rescheduleNotifications(db);
  }

  async function toggle(kind: NotifyKind, on: boolean) {
    if (busy) return;
    haptics.toggle(on);
    setBusy(true);
    try {
      if (on && !(await requestNotificationPermission())) {
        setDenied(true);
        return;
      }
      setDenied(false);
      await update({ ...prefs, [kind]: { ...prefs[kind], on } });
    } catch (e) {
      setMessage(`No se pudo cambiar: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    if (!(await requestNotificationPermission())) {
      setDenied(true);
      return;
    }
    await sendTestNotification();
    setMessage('Listo: el aviso llega en unos 5 segundos (puedes salir de la app).');
  }

  return (
    <FormScroll contentStyle={styles.content}>
      <ThemedText type="small" themeColor="textSecondary">
        Los avisos se programan en este teléfono, sin internet ni servidores. Se actualizan solos al abrir y al salir de la app.
      </ThemedText>
      {!available ? (
        <View style={[styles.box, { borderColor: theme.primaryBorder }]}>
          <ThemedText type="smallBold" accessibilityRole="alert">Las notificaciones solo funcionan en la app instalada (APK)</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Aquí puedes ver las opciones, pero no se pueden encender.</ThemedText>
        </View>
      ) : null}
      {error ? <ThemedText type="small" style={{ color: theme.expense }} accessibilityRole="alert">{error}</ThemedText> : null}
      {denied ? (
        <View style={[styles.box, { borderColor: theme.expense }]}>
          <ThemedText type="small" accessibilityRole="alert">
            Android no permite que la app muestre notificaciones. Actívalas en los ajustes del teléfono y vuelve a intentarlo.
          </ThemedText>
          <PrimaryButton label="Abrir ajustes del teléfono" variant="secondary" onPress={() => void Linking.openSettings()} />
        </View>
      ) : null}

      <View style={[styles.list, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        {NOTIFY_KINDS.map((kind, i) => (
          <View key={kind} style={[styles.row, i > 0 && styles.separator, i > 0 && { borderTopColor: theme.separator }]}>
            <View style={styles.flex}>
              <ThemedText>{TEXT[kind].title}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">{TEXT[kind].hint}</ThemedText>
            </View>
            {prefs[kind].on ? (
              <PressableScale
                onPress={() => setEditingTime(kind)}
                disabled={!available}
                accessibilityRole="button"
                accessibilityLabel={`Hora de ${TEXT[kind].title}: ${prefs[kind].time}`}
                accessibilityHint="Cambiar la hora"
                style={[styles.time, { borderColor: theme.primaryBorder }]}>
                <ThemedText type="smallBold" style={{ color: theme.primaryText }}>{prefs[kind].time}</ThemedText>
              </PressableScale>
            ) : null}
            <Switch
              value={prefs[kind].on}
              disabled={off}
              onValueChange={(on) => void toggle(kind, on)}
              accessibilityLabel={TEXT[kind].title}
              trackColor={{ true: theme.primary, false: theme.track }}
            />
          </View>
        ))}
      </View>

      <View style={[styles.list, styles.row, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <View style={styles.flex}>
          <ThemedText>Mostrar montos</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">Apagado, los avisos no dicen cifras: se ven en la pantalla de bloqueo.</ThemedText>
        </View>
        <Switch
          value={prefs.showAmounts}
          disabled={off}
          onValueChange={(showAmounts) => {
            haptics.toggle(showAmounts);
            void update({ ...prefs, showAmounts });
          }}
          accessibilityLabel="Mostrar montos en los avisos"
          trackColor={{ true: theme.primary, false: theme.track }}
        />
      </View>

      <PrimaryButton label="Probar un aviso" variant="secondary" disabled={!available} onPress={() => void test().catch((e: Error) => setMessage(`No se pudo: ${e.message}`))} />
      {message ? <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">{message}</ThemedText> : null}

      <BottomSheet visible={editingTime !== null} onClose={() => setEditingTime(null)} title={editingTime ? `Hora: ${TEXT[editingTime].title}` : 'Hora'}>
        {editingTime ? (
          <>
            <ChipGroup
              label="Hora"
              options={HOURS.map((h) => ({ value: h, label: h }))}
              value={prefs[editingTime].time.slice(0, 2)}
              onChange={(h) => void update({ ...prefs, [editingTime]: { ...prefs[editingTime], time: `${h}:${prefs[editingTime].time.slice(3)}` } })}
            />
            <ChipGroup
              label="Minutos"
              options={MINUTES.map((m) => ({ value: m, label: `:${m}` }))}
              value={MINUTES.includes(prefs[editingTime].time.slice(3)) ? prefs[editingTime].time.slice(3) : null}
              onChange={(m) => void update({ ...prefs, [editingTime]: { ...prefs[editingTime], time: `${prefs[editingTime].time.slice(0, 2)}:${m}` } })}
            />
            <PrimaryButton label="Listo" onPress={() => setEditingTime(null)} />
          </>
        ) : null}
      </BottomSheet>
    </FormScroll>
  );
}

const useStyles = makeStyles((t) => ({
  content: { padding: t.space.three, gap: t.space.four, width: '100%', maxWidth: t.size.maxContent, alignSelf: 'center' },
  list: { paddingHorizontal: t.space.three, borderRadius: t.radius.card, borderWidth: t.border.thin },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.two, paddingVertical: t.space.two, minHeight: t.size.touch },
  separator: { borderTopWidth: t.border.thin },
  flex: { flex: 1 },
  time: { minHeight: t.size.touch, justifyContent: 'center', paddingHorizontal: t.space.three, borderRadius: t.radius.pill, borderWidth: t.border.thin },
  box: { gap: t.space.three, padding: t.space.three, borderRadius: t.radius.card, borderWidth: t.border.thin },
}));
