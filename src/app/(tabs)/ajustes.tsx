import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { View } from 'react-native';

import { ChipGroup, PrimaryButton, type Option } from '@/components/form';
import { IconCircle } from '@/components/icon-circle';
import { ListRow, ListSection } from '@/components/list-row';
import { ThemedText } from '@/components/themed-text';
import { TitledScreen } from '@/components/titled-screen';
import { loadTestData } from '@/db/seed';
import type { WeekStart } from '@/domain/settings';
import { useAppearance } from '@/hooks/use-appearance';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles } from '@/hooks/use-tokens';

const WEEK_OPTIONS: Option<WeekStart>[] = [
  { value: 'sunday', label: 'Domingo' },
  { value: 'monday', label: 'Lunes' },
];

export default function AjustesScreen() {
  const theme = useTheme();
  const { settings, loaded, error, save } = useSettings();
  const { storeEnabled, storeName } = useAppearance();
  return (
    <TitledScreen title="Ajustes">
      <ListSection title="Datos">
        {[
          <ListRow
            key="cuentas"
            title="Cuentas"
            subtitle="Editar, archivar o eliminar"
            icon={<IconCircle name={{ ios: 'wallet.pass', android: 'account_balance_wallet' }} color={theme.primaryText} />}
            onPress={() => router.push('/cuentas')}
          />,
          <ListRow
            key="categorias"
            title="Categorías"
            subtitle="Crear, renombrar o archivar"
            icon={<IconCircle name={{ ios: 'square.grid.2x2', android: 'category' }} color={theme.primaryText} />}
            onPress={() => router.push('/categorias')}
          />,
          <ListRow
            key="presupuestos"
            title="Presupuestos"
            subtitle="Monto mensual por categoría y alertas"
            icon={<IconCircle name={{ ios: 'chart.pie', android: 'donut_large' }} color={theme.primaryText} />}
            onPress={() => router.push('/presupuestos')}
          />,
          <ListRow
            key="recurrentes"
            title="Pagos recurrentes"
            subtitle="Gastos fijos: pagar, omitir o pausar"
            icon={<IconCircle name={{ ios: 'arrow.triangle.2.circlepath', android: 'event_repeat' }} color={theme.primaryText} />}
            onPress={() => router.push('/recurrentes')}
          />,
          <ListRow
            key="tienda"
            title="Tienda"
            subtitle={storeEnabled ? `${storeName}: nombre y canales de venta` : 'Desactivada'}
            icon={<IconCircle name={{ ios: 'bag', android: 'storefront' }} color={theme.primaryText} />}
            onPress={() => router.push('/tienda-ajustes')}
          />,
          <ListRow
            key="respaldo"
            title="Copia de seguridad"
            subtitle="Exportar y restaurar"
            icon={<IconCircle name={{ ios: 'externaldrive', android: 'backup' }} color={theme.primaryText} />}
            onPress={() => router.push('/respaldo')}
          />,
        ]}
      </ListSection>
      <ListSection title="Personalización">
        {[
          <ListRow
            key="apariencia"
            title="Apariencia"
            subtitle="Tema, color, letra, animaciones y tu nombre"
            icon={<IconCircle name={{ ios: 'paintpalette', android: 'palette' }} color={theme.primaryText} />}
            onPress={() => router.push('/apariencia')}
          />,
          <ListRow
            key="notificaciones"
            title="Notificaciones"
            subtitle="Pagos, registro diario, copia y resumen semanal"
            icon={<IconCircle name={{ ios: 'bell', android: 'notifications' }} color={theme.primaryText} />}
            onPress={() => router.push('/notificaciones')}
          />,
          <ListRow
            key="inicio"
            title="Tarjetas del Inicio"
            subtitle="Cuáles se ven y en qué orden"
            icon={<IconCircle name={{ ios: 'square.stack', android: 'view_agenda' }} color={theme.primaryText} />}
            onPress={() => router.push('/inicio-tarjetas')}
          />,
        ]}
      </ListSection>
      <ChipGroup
        label="Primer día de la semana"
        options={WEEK_OPTIONS.map((o) => ({ ...o, disabled: !loaded }))}
        value={settings.weekStart}
        onChange={(weekStart) => save({ weekStart })}
        error={error ?? undefined}
        hint="En el calendario de fechas."
      />
      {__DEV__ && <TestDataButton />}
    </TitledScreen>
  );
}

/** Solo en desarrollo (__DEV__ es false en el APK de producción). */
function TestDataButton() {
  const styles = useStyles();
  const db = useSQLiteContext();
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function load(extreme: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await loadTestData(db, { extreme });
      setMessage({
        text: r.created === 0 ? 'Los datos [PRUEBA] ya estaban cargados.' : `Listo: ${r.created} registros creados, ${r.skipped} ya existían.`,
        error: false,
      });
    } catch (e) {
      setMessage({ text: `Error: ${(e as Error).message}`, error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.dev, { borderColor: theme.border }]}>
      <ThemedText type="caption" themeColor="textSecondary">SOLO DESARROLLO</ThemedText>
      <PrimaryButton label="Cargar datos [PRUEBA]" onPress={() => load(false)} busy={busy} variant="secondary" />
      <PrimaryButton label="Cargar datos [PRUEBA] extremos" onPress={() => load(true)} busy={busy} variant="secondary" />
      {message && (
        <ThemedText type="small" style={{ color: message.error ? theme.expense : theme.textSecondary }} accessibilityLiveRegion="polite">
          {message.text}
        </ThemedText>
      )}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  dev: { gap: t.space.two, padding: t.space.three, borderRadius: t.radius.tile, borderWidth: t.border.thin, borderStyle: 'dashed' },
}));
