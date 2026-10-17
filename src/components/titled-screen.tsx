import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { UndoHost } from '@/components/undo-toast';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles } from '@/hooks/use-tokens';

/** Pestaña con título grande y contenido desplazable (Ajustes). */
export function TitledScreen({ title, children }: { title: string; children?: ReactNode }) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" accessibilityRole="header">
          {title}
        </ThemedText>
        {children}
      </ScrollView>
      <UndoHost inTabs />
    </SafeAreaView>
  );
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1 },
  // Sin inset inferior propio: NativeTabs ya deja el contenido por encima de la barra.
  content: {
    padding: t.space.three,
    gap: t.space.three,
    width: '100%',
    maxWidth: t.size.maxContent,
    alignSelf: 'center',
  },
}));
