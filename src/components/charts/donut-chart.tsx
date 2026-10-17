import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';

import { useDrawProgress } from '@/hooks/use-draw';
import { makeStyles, useTokens } from '@/hooks/use-tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Dona con un trazo por porción (strokeDasharray): una sola porción al 100 % es un círculo completo.
 * Decorativa para el lector de pantalla: los datos van en la leyenda de texto. Se dibuja en el sentido del reloj: un
 * círculo del color del fondo (`background`) la tapa y se va retirando (solo se anima strokeDashoffset).
 */
export function DonutChart({
  parts,
  track,
  background,
  center,
}: {
  parts: { key: string; share: number; color: string }[];
  track: string;
  /** Color de la tarjeta donde está la dona (el de la tapa que se retira). */
  background: string;
  /** Contenido en el centro (p. ej. el total). */
  center?: ReactNode;
}) {
  const styles = useStyles();
  const t = useTokens();
  const size = t.size.donut;
  const thickness = t.size.donutThickness;
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const gap = parts.length > 1 ? 2 : 0;
  // Dónde empieza cada porción: suma de las anteriores (sin mutar nada durante el render).
  const starts = parts.map((_, i) => parts.slice(0, i).reduce((acc, q) => acc + q.share, 0) * circumference);
  const progress = useDrawProgress(parts.map((p) => `${p.key}:${p.share.toFixed(3)}`).join('|'));
  // Desplazamiento negativo: lo destapado crece desde arriba en el sentido del reloj.
  const cover = useAnimatedProps(() => ({ strokeDashoffset: -progress.get() * circumference }));
  return (
    <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} accessible={false} importantForAccessibility="no-hide-descendants">
      <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={thickness} fill="none" />
        {parts.map((p, i) => {
          // Porciones mínimas visibles: al menos 3 px de arco (el valor real está en la leyenda).
          const length = Math.max(p.share * circumference - gap, 3);
          return (
            <Circle
              key={p.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={p.color}
              strokeWidth={thickness}
              fill="none"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-starts[i]}
            />
          );
        })}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={background}
          strokeWidth={thickness + 2}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={cover}
        />
      </G>
    </Svg>
      {center ? <View style={styles.center}>{center}</View> : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
}));
