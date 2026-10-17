import { SymbolView } from 'expo-symbols';
import { Switch, View } from 'react-native';

import { haptics } from '@/components/haptics';
import { FormScroll, PrimaryButton } from '@/components/form';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { DEFAULT_HOME_CARDS, moveCard, toggleCard, type HomeCardId } from '@/domain/home-cards';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles, useTokens } from '@/hooks/use-tokens';

const CARD_TEXT: Record<HomeCardId, { title: string; hint: string }> = {
  store: { title: 'Tienda', hint: 'Ganancia del periodo y acumulada (solo con la tienda activada)' },
  budgets: { title: 'Alertas de presupuesto', hint: 'Solo aparece si un presupuesto llegó a su alerta' },
  upcoming: { title: 'Próximos pagos', hint: 'Vencidos y de los próximos 7 días' },
  income: { title: 'Ingresos del periodo', hint: 'Nómina y el resto por categoría' },
  accounts: { title: 'Cuentas', hint: 'Saldo de cada cuenta' },
  recent: { title: 'Últimos movimientos', hint: 'Los 5 más recientes' },
};

/** Qué tarjetas muestra el Inicio y en qué orden. El saldo total y el aviso de copia siempre se ven. */
export default function HomeCardsScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const t = useTokens();
  const { settings, loaded, error, save } = useSettings();
  const cards = settings.homeCards;
  const setCards = (next: typeof cards) => void save({ homeCards: next });

  return (
    <FormScroll contentStyle={styles.content}>
      <ThemedText type="small" themeColor="textSecondary">
        El saldo total y el aviso de copia de seguridad siempre se ven arriba. Ordena y muestra u oculta el resto.
      </ThemedText>
      {error ? (
        <ThemedText type="small" style={{ color: theme.expense }} accessibilityRole="alert">{error}</ThemedText>
      ) : null}
      <View style={[styles.list, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        {cards.map((c, i) => {
          const { title, hint } = CARD_TEXT[c.id];
          const arrow = (dir: -1 | 1) => {
            const disabled = !loaded || (dir === -1 ? i === 0 : i === cards.length - 1);
            return (
              <PressableScale
                onPress={() => {
                  haptics.selection();
                  setCards(moveCard(cards, c.id, dir));
                }}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={`${dir === -1 ? 'Subir' : 'Bajar'} ${title}`}
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
              <View style={styles.flex}>
                <ThemedText>{title}</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">{hint}</ThemedText>
              </View>
              <Switch
                value={c.visible}
                disabled={!loaded}
                onValueChange={() => {
                  haptics.toggle(!c.visible);
                  setCards(toggleCard(cards, c.id));
                }}
                trackColor={{ false: theme.track, true: theme.primary }}
                thumbColor={c.visible ? theme.onPrimary : theme.textSecondary}
                accessibilityLabel={`Mostrar ${title} en el Inicio`}
              />
              {arrow(-1)}
              {arrow(1)}
            </View>
          );
        })}
      </View>
      <PrimaryButton label="Volver al orden de siempre" variant="secondary" onPress={() => setCards(DEFAULT_HOME_CARDS)} disabled={!loaded} />
    </FormScroll>
  );
}

const useStyles = makeStyles((t) => ({
  content: { padding: t.space.three, gap: t.space.four, width: '100%', maxWidth: t.size.maxContent, alignSelf: 'center' },
  list: { paddingHorizontal: t.space.three, borderRadius: t.radius.card, borderWidth: t.border.thin },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.one, paddingVertical: t.space.two },
  flex: { flex: 1 },
  arrow: { width: t.size.touch, height: t.size.touch, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
}));
