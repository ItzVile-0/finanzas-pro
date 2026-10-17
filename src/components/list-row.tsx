import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles, useTokens } from '@/hooks/use-tokens';

/** Bloque con título y filas separadas (mismo estilo que las listas del Panel). Sin filas no se muestra. */
export function ListSection({ title, children }: { title: string; children: ReactNode[] }) {
  const styles = useStyles();
  const theme = useTheme();
  if (children.length === 0) return null;
  return (
    <View>
      <ThemedText type="smallBold" style={styles.title} accessibilityRole="header">{title}</ThemedText>
      <View style={[styles.list, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        {children.map((child, i) => (
          <View key={i} style={i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator }}>
            {child}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Fila tocable: ícono opcional, título, subtítulo, valor a la derecha y flecha de navegación. */
export function ListRow({
  title,
  subtitle,
  value,
  icon,
  onPress,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  icon?: ReactNode;
  onPress: () => void;
}) {
  const t = useTokens();
  const styles = useStyles();
  const theme = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, value].filter(Boolean).join('. ')}>
      {icon}
      <View style={styles.flex}>
        <ThemedText numberOfLines={1}>{title}</ThemedText>
        {subtitle ? <ThemedText type="small" themeColor="textSecondary">{subtitle}</ThemedText> : null}
      </View>
      {value ? <ThemedText type="smallBold" style={styles.amount}>{value}</ThemedText> : null}
      <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right' }} size={t.icon.chevron} tintColor={theme.textSecondary} />
    </PressableScale>
  );
}

const useStyles = makeStyles((t) => ({
  title: { marginBottom: t.space.two },
  list: { paddingHorizontal: t.space.three, paddingVertical: t.space.one, borderRadius: t.radius.card, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.two, paddingVertical: t.space.two + t.space.half },
  flex: { flex: 1 },
  amount: { fontVariant: ['tabular-nums'] },
}));
