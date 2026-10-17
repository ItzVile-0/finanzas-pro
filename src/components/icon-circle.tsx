import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { View } from 'react-native';

import { TINT } from '@/constants/theme';
import type { AccountType } from '@/domain/ledger';
import { makeStyles, useTokens } from '@/hooks/use-tokens';

export type IconName = SymbolViewProps['name'];

/** Ícono de cada tipo de cuenta (Panel, Cuentas, formulario de movimiento). */
export const ACCOUNT_ICON = {
  bank: { ios: 'building.columns', android: 'account_balance' },
  cash: { ios: 'banknote', android: 'payments' },
  savings: { ios: 'dollarsign.circle', android: 'savings' },
  wallet: { ios: 'wallet.pass', android: 'account_balance_wallet' },
  other: { ios: 'square.grid.2x2', android: 'category' },
} as const satisfies Record<AccountType, IconName>;

/** Ícono genérico de los canales de la migración 6 (sin logos de marca); los que crea el usuario llevan uno genérico. */
const CHANNEL_ICON: Record<string, IconName> = {
  whatsapp: { ios: 'message', android: 'chat' },
  instagram: { ios: 'camera', android: 'photo_camera' },
  marketplace: { ios: 'storefront', android: 'storefront' },
  web: { ios: 'globe', android: 'language' },
};
// shortcut: canal nuevo = ícono genérico; si se piden íconos por canal, agregar columna icon a channels.
export const channelIcon = (id: string): IconName => CHANNEL_ICON[id] ?? { ios: 'tag', android: 'sell' };

/** Ícono sobre un círculo del mismo color al ~15 % de opacidad (color + TINT). Decorativo para el lector de pantalla. */
export function IconCircle({ name, color, size: sizeProp }: { name: IconName; color: string; size?: number }) {
  const t = useTokens();
  const size = sizeProp ?? t.avatar.base;
  const styles = useStyles();
  return (
    <View
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color + TINT }]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      <SymbolView name={name} size={size / 2} tintColor={color} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  circle: { alignItems: 'center', justifyContent: 'center' },
}));
