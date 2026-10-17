import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useMotion } from '@/hooks/use-motion';
import { makeStyles } from '@/hooks/use-tokens';

const WAVE = [14, -8, 14, -4, 10, 0]; // grados: un saludo corto
const STEP = 160;

/**
 * "Hola, {nombre} 👋" (solo Inicio y la vista previa de Apariencia). La manita saluda una vez al montarse, solo con
 * Animaciones completas (ni con Suaves ni con "reducir animaciones" del sistema). El lector de pantalla lee solo "Hola, {nombre}".
 */
export function Greeting({ name }: { name: string }) {
  const styles = useStyles();
  const motion = useMotion();
  const angle = useSharedValue(0);
  const handStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.get()}deg` }] }));

  useEffect(() => {
    if (motion !== 'full') return; // girar es movimiento: solo con Animaciones completas
    angle.set(withSequence(...WAVE.map((deg) => withTiming(deg, { duration: STEP, easing: Easing.inOut(Easing.quad) }))));
  }, [motion, angle]);

  return (
    <View style={styles.row} accessible accessibilityRole="header" accessibilityLabel={`Hola, ${name}`}>
      <ThemedText type="subtitle" style={styles.shrink}>Hola, {name}</ThemedText>
      <Animated.View style={[styles.hand, handStyle]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <ThemedText type="subtitle">👋</ThemedText>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: t.space.one },
  shrink: { flexShrink: 1 },
  // Gira desde la muñeca (abajo a la derecha), como un saludo real.
  hand: { transformOrigin: '70% 85%' },
}));
