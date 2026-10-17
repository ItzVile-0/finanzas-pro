import { useState } from 'react';
import { Platform, useColorScheme, useWindowDimensions, View } from 'react-native';

import { Field } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { IconCircle, type IconName } from '@/components/icon-circle';
import { PressableScale } from '@/components/pressable-scale';
import { CategoryColors } from '@/constants/theme';
import { COLOR_KEYS, ICON_KEYS, type ColorKey, type IconKey } from '@/domain/category-style';
import { LABEL_MAX, LABEL_MIN, labelFontSize } from '@/domain/label-size';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles, useTokens } from '@/hooks/use-tokens';

/** Nombre real de cada ícono del catálogo (iOS: SF Symbols; Android: Material Symbols). tsc valida los nombres. */
export const CATEGORY_ICON: Record<IconKey, IconName> = {
  tag: { ios: 'tag', android: 'label' },
  work: { ios: 'briefcase', android: 'work' },
  laptop: { ios: 'laptopcomputer', android: 'laptop' },
  percent: { ios: 'percent', android: 'percent' },
  sell: { ios: 'dollarsign.circle', android: 'sell' },
  payments: { ios: 'banknote', android: 'payments' },
  home: { ios: 'house', android: 'home' },
  bolt: { ios: 'bolt', android: 'bolt' },
  cart: { ios: 'cart', android: 'shopping_cart' },
  bus: { ios: 'bus', android: 'directions_bus' },
  health: { ios: 'cross.case', android: 'medical_services' },
  school: { ios: 'graduationcap', android: 'school' },
  movie: { ios: 'film', android: 'movie' },
  shopping: { ios: 'bag', android: 'shopping_bag' },
  gift: { ios: 'gift', android: 'redeem' },
  subscriptions: { ios: 'repeat', android: 'subscriptions' },
  credit: { ios: 'creditcard', android: 'credit_card' },
  savings: { ios: 'chart.line.uptrend.xyaxis', android: 'savings' },
  more: { ios: 'ellipsis.circle', android: 'more_horiz' },
  restaurant: { ios: 'fork.knife', android: 'restaurant' },
  pets: { ios: 'pawprint', android: 'pets' },
  sport: { ios: 'figure.run', android: 'fitness_center' },
  travel: { ios: 'airplane', android: 'flight' },
  phone: { ios: 'iphone', android: 'smartphone' },
};

/** Color de categoría según el tema efectivo de la app. */
export function useCategoryColor(): (key: ColorKey) => string {
  const dark = useColorScheme() === 'dark';
  return (key) => CategoryColors[key][dark ? 'dark' : 'light'];
}

export function CategoryIcon({ icon, color, size }: { icon: IconKey; color: ColorKey; size?: number }) {
  const colorOf = useCategoryColor();
  return <IconCircle name={CATEGORY_ICON[icon]} color={colorOf(color)} size={size} />;
}

const GRID_COLUMNS = 3;

/**
 * Categorías en cuadrícula de 3 columnas iguales (ícono + nombre). Rol radio.
 * 3 y no 4: con 4, "Entretenimiento" no cabe en un teléfono de 360 dp sin bajar de 10 px.
 * El tamaño de letra sale del ancho real de la celda (labelFontSize) para no partir palabras.
 */
export function CategoryGrid({
  label,
  options,
  value,
  onChange,
  error,
  empty,
}: {
  label: string;
  options: { value: string; label: string; icon: IconKey; color: ColorKey }[];
  value: string | null;
  onChange: (v: string) => void;
  error?: string;
  empty?: string;
}) {
  const styles = useStyles();
  const theme = useTheme();
  const t = useTokens();
  // Lo que la celda le quita al texto: padding de la columna + borde + padding del ítem, a cada lado.
  const cellInset = 2 * (t.space.half + t.border.selected + t.space.one);
  const [textWidth, setTextWidth] = useState(0);
  const { fontScale } = useWindowDimensions();
  // El tamaño ya cuenta la fuente, el tamaño de letra y la del sistema (con tope): por eso allowFontScaling={false}.
  function sizeFor(label: string, width: number) {
    const max = Math.round(LABEL_MAX * t.textScale * Math.min(fontScale, t.maxFontSizeMultiplier));
    const fontSize = width > 0 ? labelFontSize(label, width, t.charWidth, max) : LABEL_MIN;
    return { fontSize, lineHeight: Math.round(fontSize * Math.max(1.3, t.lineRatio)) };
  }

  return (
    <Field label={label} error={error}>
      {options.length === 0 && empty ? <ThemedText type="small" themeColor="textSecondary">{empty}</ThemedText> : null}
      <View
        style={styles.grid}
        onLayout={(e) => setTextWidth(e.nativeEvent.layout.width / GRID_COLUMNS - cellInset)}
        accessibilityRole="radiogroup"
        accessibilityLabel={label}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            // Columna = View al 25 %: PressableScale aplica su estilo a una vista interior.
            <View key={o.value} style={styles.gridCol}>
              <PressableScale
                onPress={() => onChange(o.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${label}: ${o.label}`}
                style={[
                  styles.gridItem,
                  { borderColor: selected ? theme.primaryText : 'transparent', backgroundColor: selected ? theme.backgroundElement : 'transparent' },
                ]}>
                <CategoryIcon icon={o.icon} color={o.color} size={t.avatar.lg} />
                <ThemedText
                  type="caption"
                  numberOfLines={2}
                  textBreakStrategy={Platform.OS === 'android' ? 'simple' : undefined}
                  android_hyphenationFrequency="none"
                  allowFontScaling={false}
                  style={[styles.gridLabel, sizeFor(o.label, textWidth)]}>
                  {o.label}
                </ThemedText>
              </PressableScale>
            </View>
          );
        })}
      </View>
    </Field>
  );
}

const ICON_LABEL: Record<IconKey, string> = {
  tag: 'Etiqueta', work: 'Trabajo', laptop: 'Computador', percent: 'Porcentaje', sell: 'Venta', payments: 'Billetes',
  home: 'Casa', bolt: 'Energía', cart: 'Mercado', bus: 'Bus', health: 'Salud', school: 'Estudio', movie: 'Cine',
  shopping: 'Compras', gift: 'Regalo', subscriptions: 'Suscripción', credit: 'Tarjeta', savings: 'Ahorro', more: 'Otros',
  restaurant: 'Restaurante', pets: 'Mascotas', sport: 'Deporte', travel: 'Viaje', phone: 'Celular',
};
const COLOR_LABEL: Record<ColorKey, string> = {
  slate: 'Gris', red: 'Rojo', orange: 'Naranja', amber: 'Ámbar', green: 'Verde', teal: 'Verde azulado', blue: 'Azul',
  indigo: 'Índigo', purple: 'Morado', pink: 'Rosado',
};

/** Selector de ícono (cuadrícula) y color (fila de círculos) para una categoría. Rol radio, accesible. */
export function CategoryStylePicker({
  icon,
  color,
  onChange,
}: {
  icon: IconKey;
  color: ColorKey;
  onChange: (style: { icon: IconKey; color: ColorKey }) => void;
}) {
  const t = useTokens();
  const styles = useStyles();
  const theme = useTheme();
  const colorOf = useCategoryColor();
  return (
    <>
      <Field label="Ícono">
        <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel="Ícono">
          {ICON_KEYS.map((k) => (
            <PressableScale
              key={k}
              onPress={() => onChange({ icon: k, color })}
              accessibilityRole="radio"
              accessibilityState={{ selected: k === icon }}
              accessibilityLabel={`Ícono: ${ICON_LABEL[k]}`}
              style={[styles.tile, { borderColor: k === icon ? theme.primaryText : 'transparent' }]}>
              <IconCircle name={CATEGORY_ICON[k]} color={colorOf(color)} size={t.avatar.lg} />
            </PressableScale>
          ))}
        </View>
      </Field>
      <Field label="Color">
        <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel="Color">
          {COLOR_KEYS.map((k) => (
            <PressableScale
              key={k}
              onPress={() => onChange({ icon, color: k })}
              accessibilityRole="radio"
              accessibilityState={{ selected: k === color }}
              accessibilityLabel={`Color: ${COLOR_LABEL[k]}`}
              style={[styles.tile, { borderColor: k === color ? theme.text : 'transparent' }]}>
              <View style={[styles.swatch, { backgroundColor: colorOf(k) }]} />
            </PressableScale>
          ))}
        </View>
      </Field>
    </>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.one },
  tile: { borderWidth: t.border.selected, borderRadius: t.radius.pill, padding: t.space.half },
  swatch: { width: t.size.swatch, height: t.size.swatch, borderRadius: t.size.swatch / 2, margin: t.space.one + t.space.half },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridCol: { width: `${100 / GRID_COLUMNS}%`, padding: t.space.half },
  gridItem: { alignItems: 'center', gap: t.space.one, borderWidth: t.border.selected, borderRadius: t.radius.control, paddingVertical: t.space.two, paddingHorizontal: t.space.one },
  gridLabel: { textAlign: 'center' },
}));
