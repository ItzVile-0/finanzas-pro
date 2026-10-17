import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Switch, View } from 'react-native';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { Field, FormScroll, PrimaryButton, TextField } from '@/components/form';
import { haptics } from '@/components/haptics';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { createChannel, deleteChannel, renameChannel, reorderChannels, setChannelArchived } from '@/db/ledger';
import { CHANNEL_NAME_MAX, channelRemoval, recordTypeOf } from '@/domain/store';
import { normalizeStoreName, STORE_NAME_MAX } from '@/domain/settings';
import { notifyLedgerChanged, useLedger } from '@/hooks/use-ledger';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles, useTokens } from '@/hooks/use-tokens';

type Done = { ok: true } | { ok: false; error: string };

/** Ajustes → Tienda: activar o desactivar (nunca borra registros), nombre y canales de venta. */
export default function StoreSettingsScreen() {
  const styles = useStyles();
  const t = useTokens();
  const db = useSQLiteContext();
  const theme = useTheme();
  const { ledger, error: loadError } = useLedger();
  const { settings, loaded, error: settingsError, save } = useSettings();
  const [name, setName] = useState<string | null>(null); // null = el guardado
  const [newChannel, setNewChannel] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const records = ledger?.transactions.filter((tx) => recordTypeOf(tx) !== null).length ?? 0;
  const channels = ledger?.channels ?? [];
  const shownName = name ?? settings.storeName;

  /** Una operación de canales: si el dominio la rechaza, el motivo queda a la vista. */
  async function run(action: () => Promise<Done | void>, after?: () => void) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await action();
      if (r && !r.ok) setMessage(r.error);
      else {
        setMessage(null);
        haptics.success();
        after?.();
      }
      notifyLedgerChanged();
    } catch (e) {
      setMessage(`No se pudo completar: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function toggleStore(on: boolean) {
    haptics.toggle(on);
    if (!on && records > 0) setConfirmOff(true);
    else void save({ storeEnabled: on });
  }

  function move(i: number, dir: -1 | 1) {
    const ids = channels.map((c) => c.id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    haptics.selection();
    void run(() => reorderChannels(db, ids));
  }

  const edited = editing ? channels.find((c) => c.id === editing.id) : undefined;
  const removal = edited && ledger ? channelRemoval(edited.id, channels, ledger.transactions) : null;

  return (
    <FormScroll contentStyle={styles.content}>
      {loadError || settingsError ? (
        <ThemedText type="small" style={{ color: theme.expense }} accessibilityRole="alert">{loadError ?? settingsError}</ThemedText>
      ) : null}
      <Field label="Tienda o negocio" hint="Activa una pestaña para registrar inversiones y ventas, aparte de tus finanzas personales.">
        <View style={styles.switchRow}>
          <ThemedText style={styles.flex}>{settings.storeEnabled ? 'Activada' : 'Desactivada'}</ThemedText>
          <Switch
            value={settings.storeEnabled}
            disabled={!loaded}
            onValueChange={toggleStore}
            accessibilityLabel="Activar la tienda"
            trackColor={{ true: theme.primary, false: theme.track }}
          />
        </View>
      </Field>

      {settings.storeEnabled ? (
        <>
          <TextField
            label="Nombre de la tienda"
            value={shownName}
            onChangeText={setName}
            maxLength={STORE_NAME_MAX}
            hint="Se usa en la pestaña, el Inicio, Movimientos e Informes."
          />
          <PrimaryButton
            label="Guardar nombre"
            variant="secondary"
            disabled={name === null || normalizeStoreName(name) === settings.storeName}
            onPress={async () => {
              if (name !== null && (await save({ storeName: normalizeStoreName(name) }))) {
                haptics.success();
                setName(null);
              }
            }}
          />

          <View style={styles.section}>
            <ThemedText type="smallBold" accessibilityRole="header">Canales de venta</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">Toca uno para renombrarlo, archivarlo o eliminarlo. Un canal con ventas no se elimina: se archiva.</ThemedText>
            <View style={[styles.list, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              {channels.map((c, i) => {
                const arrow = (dir: -1 | 1) => {
                  const disabled = busy || (dir === -1 ? i === 0 : i === channels.length - 1);
                  return (
                    <PressableScale
                      onPress={() => move(i, dir)}
                      disabled={disabled}
                      accessibilityRole="button"
                      accessibilityLabel={`${dir === -1 ? 'Subir' : 'Bajar'} ${c.name}`}
                      style={[styles.arrow, disabled && styles.disabled]}>
                      <SymbolView
                        name={dir === -1 ? { ios: 'chevron.up', android: 'keyboard_arrow_up' } : { ios: 'chevron.down', android: 'keyboard_arrow_down' }}
                        size={t.icon.xl}
                        tintColor={theme.text}
                      />
                    </PressableScale>
                  );
                };
                return (
                  <View key={c.id} style={[styles.row, i > 0 && { borderTopWidth: t.border.thin, borderTopColor: theme.separator }]}>
                    <PressableScale
                      style={[styles.flex, styles.name]}
                      onPress={() => setEditing({ id: c.id, name: c.name })}
                      accessibilityRole="button"
                      accessibilityLabel={`${c.name}${c.archived ? ', archivado' : ''}`}
                      accessibilityHint="Renombrar, archivar o eliminar">
                      <ThemedText style={c.archived && { color: theme.textSecondary }}>{c.name}</ThemedText>
                      {c.archived ? <ThemedText type="caption" themeColor="textSecondary">Archivado: no se elige en ventas nuevas</ThemedText> : null}
                    </PressableScale>
                    {arrow(-1)}
                    {arrow(1)}
                  </View>
                );
              })}
            </View>
          </View>

          {edited && editing ? (
            <View style={[styles.editor, { borderColor: theme.primaryBorder }]}>
              <TextField label={`Editar "${edited.name}"`} value={editing.name} onChangeText={(v) => setEditing({ ...editing, name: v })} maxLength={CHANNEL_NAME_MAX} />
              <PrimaryButton label="Guardar canal" variant="secondary" busy={busy} onPress={() => run(() => renameChannel(db, edited.id, editing.name), () => setEditing(null))} />
              {edited.archived || removal?.canArchive ? (
                <PrimaryButton
                  label={edited.archived ? 'Desarchivar' : 'Archivar'}
                  variant="secondary"
                  busy={busy}
                  onPress={() => run(() => setChannelArchived(db, edited.id, !edited.archived), () => setEditing(null))}
                />
              ) : (
                <ThemedText type="caption" themeColor="textSecondary">Es el único canal activo: no se puede archivar ni eliminar.</ThemedText>
              )}
              {removal?.canDelete ? <PrimaryButton label="Eliminar canal" variant="danger" busy={busy} onPress={() => setConfirmDelete(true)} /> : null}
              <PrimaryButton label="Cancelar" variant="secondary" onPress={() => setEditing(null)} />
            </View>
          ) : null}

          <TextField label="Nuevo canal" value={newChannel} onChangeText={setNewChannel} placeholder="Ej.: TikTok" maxLength={CHANNEL_NAME_MAX} />
          <PrimaryButton label="Agregar canal" busy={busy} disabled={!newChannel.trim()} onPress={() => run(() => createChannel(db, newChannel), () => setNewChannel(''))} />
          {message ? <ThemedText type="small" style={{ color: theme.expense }} accessibilityRole="alert">{message}</ThemedText> : null}
        </>
      ) : records > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Tienes {records} {records === 1 ? 'registro' : 'registros'} de la tienda: siguen contando en los saldos de tus cuentas y aparecen en Movimientos.
        </ThemedText>
      ) : null}

      <ConfirmDialog
        visible={confirmOff}
        title="¿Desactivar la tienda?"
        message={`Tus ${records} ${records === 1 ? 'registro sigue' : 'registros siguen'} contando en los saldos de tus cuentas y en Movimientos. No se borra nada; la pestaña y la tarjeta del Inicio se ocultan.`}
        confirmLabel="Desactivar"
        onCancel={() => setConfirmOff(false)}
        onConfirm={() => {
          setConfirmOff(false);
          void save({ storeEnabled: false });
        }}
      />
      <ConfirmDialog
        visible={confirmDelete}
        title="¿Eliminar este canal?"
        message="No tiene ventas. No se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          if (edited) void run(() => deleteChannel(db, edited.id), () => setEditing(null));
        }}
      />
    </FormScroll>
  );
}

const useStyles = makeStyles((t) => ({
  content: { padding: t.space.three, gap: t.space.four, width: '100%', maxWidth: t.size.maxContent, alignSelf: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: t.size.touch },
  flex: { flex: 1 },
  section: { gap: t.space.two },
  list: { paddingHorizontal: t.space.three, borderRadius: t.radius.card, borderWidth: t.border.thin },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.one, paddingVertical: t.space.one },
  name: { minHeight: t.size.touch, justifyContent: 'center' },
  arrow: { width: t.size.touch, height: t.size.touch, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
  editor: { gap: t.space.three, padding: t.space.three, borderRadius: t.radius.card, borderWidth: t.border.thin },
}));
