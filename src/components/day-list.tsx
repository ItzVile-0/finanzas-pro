import type { ReactElement } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LayoutAnimationConfig } from 'react-native-reanimated';

import { AnimatedRow } from '@/components/animated-row';
import { Breathing } from '@/components/breathing';
import { IconCircle } from '@/components/icon-circle';
import { MovementRow } from '@/components/movement-row';
import { ThemedText } from '@/components/themed-text';
import { groupByDay, todayLocal } from '@/domain/dates';
import type { Category, Transaction } from '@/domain/ledger';
import type { Channel } from '@/domain/store';
import { motionDuration } from '@/domain/motion';
import { useMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles, useTokens } from '@/hooks/use-tokens';

/**
 * Movimientos agrupados por día ("Hoy", "Ayer", "12 oct"): cada día es una tarjeta como las del Inicio. Las filas nuevas
 * entran y las eliminadas salen (AnimatedRow); la primera carga no se anima.
 */
export function DayList({
  items,
  categories,
  channels,
  hidden,
  noBusinessTag,
  onOpen,
  header,
  empty,
  ready,
}: {
  items: readonly Transaction[];
  categories: readonly Category[];
  channels: readonly Channel[];
  hidden: boolean;
  noBusinessTag?: boolean;
  onOpen: (tx: Transaction) => void;
  header?: ReactElement;
  empty: string;
  /** false mientras se leen los datos: la lista se monta ya con ellos (aparece suave y sin animar cada fila). */
  ready: boolean;
}) {
  const styles = useStyles();
  const theme = useTheme();
  const t = useTokens();
  const byId = new Map(categories.map((c) => [c.id, c])); // una búsqueda por fila, no un recorrido de la lista
  const channelName = new Map(channels.map((c) => [c.id, c.name]));
  const sections = groupByDay(items, todayLocal());
  const motion = useMotion();
  if (!ready) {
    return (
      <View style={[styles.content, { backgroundColor: theme.background }]}>
        {header}
        <ThemedText themeColor="textSecondary" style={styles.empty}>{empty}</ThemedText>
      </View>
    );
  }
  return (
    <Animated.View style={styles.flex} entering={motion === 'off' ? undefined : FadeIn.duration(motionDuration(motion, 250))}>
      <LayoutAnimationConfig skipEntering>
        <SectionList
          // Virtualización: pocas filas fuera de la vista (memoria) y Android recorta lo que no se ve.
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={9}
          removeClippedSubviews
          style={{ backgroundColor: theme.background }}
          contentContainerStyle={styles.content}
          sections={sections}
          keyExtractor={(t) => t.id}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={header}
          ListEmptyComponent={
          empty ? (
            <View style={styles.emptyBox}>
              <Breathing>
                <IconCircle name={{ ios: 'list.bullet.rectangle', android: 'receipt_long' }} color={theme.primaryText} size={t.avatar.hero} />
              </Breathing>
              <ThemedText themeColor="textSecondary" style={styles.center}>{empty}</ThemedText>
            </View>
          ) : null
        }
          renderSectionHeader={({ section }) => (
            <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header" style={styles.day}>
              {section.title}
            </ThemedText>
          )}
          renderItem={({ item, index, section }) => (
            <AnimatedRow>
              <View
                style={[
                  styles.item,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  index === 0 && styles.first,
                  index === section.data.length - 1 && styles.last,
                ]}>
                <MovementRow
                  tx={item}
                  category={item.category_id ? byId.get(item.category_id) : undefined}
                  hidden={hidden}
                  noBusinessTag={noBusinessTag}
                  channelName={item.channel_id ? channelName.get(item.channel_id) : undefined}
                  onPress={() => onOpen(item)}
                  style={index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator }}
                />
              </View>
            </AnimatedRow>
          )}
        />
      </LayoutAnimationConfig>
    </Animated.View>
  );
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1 },
  content: { padding: t.space.three, width: '100%', maxWidth: t.size.maxContent, alignSelf: 'center' },
  empty: { marginTop: t.space.three },
  emptyBox: { alignItems: 'center', gap: t.space.three, paddingVertical: t.space.five },
  center: { textAlign: 'center' },
  day: { marginTop: t.space.three, marginBottom: t.space.two },
  item: { paddingHorizontal: t.space.three, borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth },
  first: { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: t.radius.card, borderTopRightRadius: t.radius.card, paddingTop: t.space.one },
  last: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: t.radius.card, borderBottomRightRadius: t.radius.card, paddingBottom: t.space.one },
}));
