import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useAppearance } from '@/hooks/use-appearance';
import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  const colors = useTheme();
  // Sin tienda (bienvenida o Ajustes → Tienda) quedan 4 pestañas; con tienda, la pestaña lleva su nombre.
  const { storeEnabled, storeName } = useAppearance();

  return (
    <NativeTabs
      backgroundColor={colors.backgroundElement}
      indicatorColor={colors.backgroundSelected}
      labelVisibilityMode="labeled"
      iconColor={{ default: colors.textSecondary, selected: colors.primaryText }}
      labelStyle={{ default: { color: colors.textSecondary }, selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Inicio</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="home" sf="house.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="movimientos">
        <NativeTabs.Trigger.Label>Movimientos</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="swap_vert" sf="arrow.up.arrow.down" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="tienda" hidden={!storeEnabled}>
        <NativeTabs.Trigger.Label>{storeName}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="storefront" sf="bag.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="informes">
        <NativeTabs.Trigger.Label>Informes</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="bar_chart" sf="chart.bar.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="ajustes">
        <NativeTabs.Trigger.Label>Ajustes</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="settings" sf="gearshape.fill" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
