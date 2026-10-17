import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { View } from 'react-native';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormScroll, PrimaryButton, TextField } from '@/components/form';
import { haptics } from '@/components/haptics';
import { ThemedText } from '@/components/themed-text';
import {
  exportBackup,
  hasPreRestoreCopy,
  openBackup,
  pickBackup,
  restoreBackup,
  undoRestore,
  type PickedBackup,
} from '@/db/backup';
import { loadSettings } from '@/db/settings';
import { localDateOf, PASSWORD_MIN, validateNewPassword, type BackupData, type BackupSummary } from '@/domain/backup';
import { formatLongDate } from '@/domain/dates';
import { applyAppearance, useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles } from '@/hooks/use-tokens';

type Busy = 'export' | 'open' | 'restore' | 'undo' | null;
type Message = { text: string; error: boolean };

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const longDate = (iso: string | null) => (iso ? formatLongDate(iso) : 'fecha desconocida');

/** Copia cifrada (exportar/restaurar) y volver a los datos de antes de restaurar. Los CSV están en Informes. */
export default function BackupScreen() {
  const styles = useStyles();
  const db = useSQLiteContext();
  const theme = useTheme();
  // Una operación a la vez: todos los botones se deshabilitan mientras algo trabaja.
  const [busy, setBusy] = useState<Busy>(null);
  const { settings, loaded } = useSettings();
  const [exportedNow, setExportedNow] = useState<string | null>(null);
  const lastBackup = exportedNow ?? settings.lastBackupAt;
  const [message, setMessage] = useState<Message | null>(null);

  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [exportError, setExportError] = useState<string>();

  const [picked, setPicked] = useState<PickedBackup | null>(null);
  const [restorePassword, setRestorePassword] = useState('');
  const [opened, setOpened] = useState<{ data: BackupData; summary: BackupSummary } | null>(null);
  const [restoreError, setRestoreError] = useState<string>();

  const [canUndo, setCanUndo] = useState(hasPreRestoreCopy);
  const [confirm, setConfirm] = useState<'restore' | 'undo' | null>(null);

  async function run(kind: Exclude<Busy, null>, task: () => Promise<void>) {
    if (busy) return;
    setBusy(kind);
    setMessage(null);
    try {
      await task();
    } finally {
      setBusy(null);
    }
  }

  const doExport = () =>
    run('export', async () => {
      const invalid = validateNewPassword(password, password2);
      setExportError(invalid ?? undefined);
      if (invalid) return;
      try {
        setExportedNow(await exportBackup(db, password));
        setPassword('');
        setPassword2('');
        haptics.success();
        setMessage({ text: 'Copia exportada. Comprueba que quedó guardada en Drive o donde la enviaste.', error: false });
      } catch (e) {
        setExportError(`No se pudo exportar: ${errorText(e)}`);
      }
    });

  const doPick = () =>
    run('open', async () => {
      setRestoreError(undefined);
      try {
        const file = await pickBackup();
        if (!file) return;
        setPicked(file);
        setOpened(null);
        setRestorePassword('');
      } catch (e) {
        setPicked(null);
        setRestoreError(errorText(e));
      }
    });

  const doOpen = () =>
    run('open', async () => {
      if (!picked) return;
      setRestoreError(undefined);
      try {
        setOpened(await openBackup(db, picked.text, restorePassword));
      } catch (e) {
        setRestoreError(errorText(e));
      }
    });

  const doRestore = () =>
    run('restore', async () => {
      if (!opened) return;
      try {
        await restoreBackup(db, opened.data);
        applyAppearance(await loadSettings(db)); // el tema y la apariencia de la copia, al instante
        haptics.success();
        const { accounts, movements } = opened.summary;
        setMessage({ text: `Datos restaurados: ${accounts} cuentas y ${movements} movimientos.`, error: false });
        setPicked(null);
        setOpened(null);
        setRestorePassword('');
      } catch (e) {
        setRestoreError(`No se restauró nada: ${errorText(e)}`);
      } finally {
        setCanUndo(hasPreRestoreCopy());
      }
    });

  const doUndo = () =>
    run('undo', async () => {
      try {
        await undoRestore(db);
        applyAppearance(await loadSettings(db));
        haptics.success();
        setMessage({ text: 'Volviste a los datos de antes de restaurar.', error: false });
      } catch (e) {
        setMessage({ text: errorText(e), error: true });
      } finally {
        setCanUndo(hasPreRestoreCopy());
      }
    });

  const s = opened?.summary;
  return (
    <FormScroll contentStyle={styles.content}>
      {message ? (
        <ThemedText
          type="smallBold"
          style={{ color: message.error ? theme.expense : theme.income }}
          accessibilityRole={message.error ? 'alert' : undefined}
          accessibilityLiveRegion="polite">
          {message.text}
        </ThemedText>
      ) : null}

      <View style={styles.section}>
        <ThemedText type="subtitle">Exportar copia cifrada</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Todos tus datos y ajustes en un archivo .fpbak cifrado. Guárdalo en Drive o pásalo a la USB.
        </ThemedText>
        {loaded ? (
          <ThemedText type="smallBold">
            {lastBackup ? `Última copia exportada: ${longDate(localDateOf(lastBackup))}` : 'Aún no has exportado ninguna copia.'}
          </ThemedText>
        ) : null}
        <TextField
          label="Contraseña de la copia"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          hint={`Mínimo ${PASSWORD_MIN} caracteres. Si la olvidas, la copia no se puede abrir: guárdala en tu gestor de contraseñas.`}
        />
        <TextField
          label="Repite la contraseña"
          value={password2}
          onChangeText={setPassword2}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          error={exportError}
        />
        <PrimaryButton label="Exportar copia cifrada" onPress={doExport} busy={busy === 'export'} busyLabel="Cifrando…" disabled={!!busy} />
      </View>

      <View style={styles.section}>
        <ThemedText type="subtitle">Restaurar desde una copia</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Primero ves qué tiene la copia; nada cambia hasta que confirmes. Puedes cancelar para solo comprobar que el archivo sirve.
        </ThemedText>
        <PrimaryButton
          label={picked ? 'Elegir otro archivo' : 'Elegir archivo .fpbak'}
          onPress={doPick}
          busy={busy === 'open' && !picked}
          busyLabel="Abriendo…"
          disabled={!!busy}
          variant="secondary"
        />
        {picked && !opened ? (
          <>
            <ThemedText type="small">
              {picked.name} · copia del {longDate(localDateOf(picked.exportedAt))}
            </ThemedText>
            <TextField
              label="Contraseña de esa copia"
              value={restorePassword}
              onChangeText={setRestorePassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
            />
            <PrimaryButton label="Abrir copia" onPress={doOpen} busy={busy === 'open'} busyLabel="Descifrando…" disabled={!!busy || !restorePassword} variant="secondary" />
          </>
        ) : null}
        {s ? (
          <View style={[styles.summary, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]} accessible>
            <ThemedText type="smallBold">Copia del {longDate(localDateOf(s.exportedAt))}</ThemedText>
            <ThemedText type="small">{s.accounts} cuentas · {s.movements} movimientos</ThemedText>
            {s.firstDate && s.lastDate ? (
              <ThemedText type="small" themeColor="textSecondary">
                Movimientos del {longDate(s.firstDate)} al {longDate(s.lastDate)}
              </ThemedText>
            ) : null}
          </View>
        ) : null}
        {restoreError ? (
          <ThemedText type="small" style={{ color: theme.expense }} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {restoreError}
          </ThemedText>
        ) : null}
        {opened ? (
          <PrimaryButton label="Restaurar esta copia" onPress={() => setConfirm('restore')} busy={busy === 'restore'} busyLabel="Restaurando…" disabled={!!busy} variant="danger" />
        ) : null}
        {canUndo ? (
          <PrimaryButton label="Volver a los datos de antes de restaurar" onPress={() => setConfirm('undo')} busy={busy === 'undo'} busyLabel="Restaurando…" disabled={!!busy} variant="danger" />
        ) : null}
      </View>

      <ConfirmDialog
        visible={confirm === 'restore'}
        title="¿Reemplazar todos tus datos?"
        message={`Todos los datos actuales se reemplazarán por los de la copia (${s?.accounts ?? 0} cuentas, ${s?.movements ?? 0} movimientos), también los ajustes. Antes se guarda una copia de lo actual para poder volver.`}
        confirmLabel="Reemplazar"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          doRestore();
        }}
      />
      <ConfirmDialog
        visible={confirm === 'undo'}
        title="¿Volver a los datos de antes?"
        message="Se reemplazan los datos actuales por los que había justo antes de la última restauración."
        confirmLabel="Volver"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          doUndo();
        }}
      />
    </FormScroll>
  );
}

const useStyles = makeStyles((t) => ({
  content: { padding: t.space.three, gap: t.space.five, width: '100%', maxWidth: t.size.maxContent, alignSelf: 'center' },
  section: { gap: t.space.three },
  summary: { gap: t.space.one, padding: t.space.three, borderRadius: t.radius.tile, borderWidth: t.border.thin },
}));
