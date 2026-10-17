import { useEffect, useRef, useState, type ReactNode } from 'react';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { CalendarModal } from '@/components/calendar-modal';
import { haptics } from '@/components/haptics';
import { IconCircle, type IconName } from '@/components/icon-circle';
import { PressableScale } from '@/components/pressable-scale';
import { useFitSize } from '@/components/fit-text';
import { ThemedText } from '@/components/themed-text';
import { UndoHost } from '@/components/undo-toast';
import { addDays, formatLongDate, formatShortDate, todayLocal } from '@/domain/dates';
import { formatCOPInput } from '@/domain/money';
import { TINT } from '@/constants/theme';
import { motionDuration } from '@/domain/motion';
import { useMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles, useTokens } from '@/hooks/use-tokens';

/**
 * Contenedor de todo formulario: ningún campo queda tapado por el teclado.
 * Android (edge-to-edge, sin adjustResize): KeyboardAvoidingView encoge el ScrollView y este lleva el campo con foco a la vista.
 * iOS: el ScrollView ajusta sus márgenes al teclado.
 */
export function FormScroll({ contentStyle, children }: { contentStyle: StyleProp<ViewStyle>; children: ReactNode }) {
  const styles = useStyles();
  const theme = useTheme();
  const box = useRef<View>(null);
  // Alto de lo que hay encima (encabezado, barra de estado): KeyboardAvoidingView mide en coordenadas de ventana.
  const [top, setTop] = useState(0);
  return (
    <View ref={box} style={[styles.flex, { backgroundColor: theme.background }]} onLayout={() => box.current?.measureInWindow((_x, y) => setTop(y))}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'android' ? 'padding' : undefined} keyboardVerticalOffset={top}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={contentStyle}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
      <UndoHost inTabs={false} />
    </View>
  );
}

/** Etiqueta + control + error justo debajo (anunciado por el lector de pantalla). */
export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      {children}
      {error ? (
        <ThemedText type="small" style={{ color: theme.expense }} accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </ThemedText>
      ) : hint ? (
        <ThemedText type="caption" themeColor="textSecondary">{hint}</ThemedText>
      ) : null}
    </View>
  );
}

export function TextField({ label, error, hint, ...input }: TextInputProps & { label: string; error?: string; hint?: string }) {
  const styles = useStyles();
  const t = useTokens();
  const theme = useTheme();
  return (
    <Field label={label} error={error} hint={hint}>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        maxFontSizeMultiplier={t.maxFontSizeMultiplier}
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: error ? theme.expense : theme.border },
        ]}
        {...input}
      />
    </Field>
  );
}

/** Campo de pesos: teclado numérico y miles en vivo ("3.000.000"). */
// shortcut: el cursor queda siempre al final (no se edita en medio del número); si molesta, controlar la selección.
export function MoneyField({
  value,
  onChangeText,
  ...props
}: Omit<TextInputProps, 'value' | 'onChangeText'> & { label: string; error?: string; hint?: string; value: string; onChangeText: (t: string) => void }) {
  return (
    <TextField
      {...props}
      value={value}
      onChangeText={(t) => onChangeText(formatCOPInput(t, value))}
      keyboardType="number-pad"
      selection={{ start: value.length, end: value.length }}
    />
  );
}

/** Monto grande y centrado (formulario de movimiento): miles en vivo, teclado numérico, cursor al final. */
export function AmountField({
  value,
  onChangeText,
  error,
  autoFocus,
  label = 'Valor en pesos',
}: {
  value: string;
  onChangeText: (t: string) => void;
  error?: string;
  autoFocus?: boolean;
  label?: string;
}) {
  const styles = useStyles();
  const theme = useTheme();
  const t = useTokens();
  const [width, setWidth] = useState(0);
  // "$ " + el número: con Muy grande y una fuente ancha, un monto largo se achica en vez de salirse de la pantalla.
  const size = useFitSize(`$ ${value || '0'}`, width, t.amount);
  return (
    <View style={styles.amountBox}>
      <View style={styles.amountRow} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <ThemedText allowFontScaling={false} style={[styles.amountText, size, { color: theme.textSecondary }]}>$</ThemedText>
        <TextInput
          value={value}
          onChangeText={(t) => onChangeText(formatCOPInput(t, value))}
          keyboardType="number-pad"
          autoFocus={autoFocus}
          selection={{ start: value.length, end: value.length }}
          placeholder="0"
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel={label}
          accessibilityHint={error}
          allowFontScaling={false}
          style={[styles.amountText, styles.amountInput, size, { color: theme.text }]}
        />
      </View>
      {error ? (
        <ThemedText type="small" style={[styles.center, { color: theme.expense }]} accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** `fontFamily`: la etiqueta se muestra en esa fuente (selector de fuente de Apariencia). */
export type Option<T extends string> = { value: T; label: string; disabled?: boolean; fontFamily?: string };

/** Selector segmentado: opciones del mismo ancho en una barra; un indicador del acento se desliza a la elegida. Rol radio. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  hint,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  error?: string;
  hint?: string;
}) {
  const styles = useStyles();
  const theme = useTheme();
  const t = useTokens();
  const motion = useMotion();
  // Ancho de cada opción: el de la barra menos su borde, su relleno y los espacios entre opciones.
  const [barWidth, setBarWidth] = useState(0);
  const n = options.length;
  const seg = barWidth > 0 ? (barWidth - 2 * t.border.thin - 2 * t.space.half - (n - 1) * t.space.half) / n : 0;
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useSharedValue(0);
  const measured = useRef(0); // al medir por primera vez (o cambiar el ancho) va directo: solo se desliza al elegir
  useEffect(() => {
    const target = index * (seg + t.space.half);
    const jump = motion === 'off' || measured.current !== seg;
    measured.current = seg;
    x.set(jump ? target : withTiming(target, { duration: motionDuration(motion, 220), easing: Easing.out(Easing.cubic) }));
  }, [index, seg, motion, t.space.half, x]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  return (
    <Field label={label} error={error} hint={hint}>
      <View
        style={[styles.segments, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
        accessibilityRole="radiogroup"
        accessibilityLabel={label}>
        {seg > 0 ? (
          <Animated.View
            style={[styles.indicator, { width: seg, backgroundColor: theme.primary }, slide]}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          />
        ) : null}
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <View key={o.value} style={styles.flex}>
              <PressableScale
                onPress={() => {
                  if (!selected) haptics.selection();
                  onChange(o.value);
                }}
                disabled={o.disabled}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled: !!o.disabled }}
                accessibilityLabel={`${label}: ${o.label}`}
                style={[styles.segment, selected && !seg && { backgroundColor: theme.primary }, o.disabled && !selected && styles.disabled]}>
                <ThemedText type="small" numberOfLines={1} adjustsFontSizeToFit style={{ color: selected ? theme.onPrimary : theme.text }}>
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

/** Cuentas como tarjetas en fila horizontal (ícono, nombre y saldo). Rol radio. */
export function AccountCards({
  label,
  options,
  value,
  onChange,
  error,
  empty,
}: {
  label: string;
  options: { value: string; label: string; balance: string; icon: IconName }[];
  value: string | null;
  onChange: (v: string) => void;
  error?: string;
  empty?: string;
}) {
  const styles = useStyles();
  const theme = useTheme();
  const t = useTokens();
  // Posición x de cada tarjeta (menos un margen): al abrir (o al rellenar la edición) se desplaza hasta la elegida.
  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef<Record<string, number>>({});
  const reveal = (x: number | undefined) => {
    if (x !== undefined) scrollRef.current?.scrollTo({ x: Math.max(0, x), animated: false });
  };
  useEffect(() => {
    if (value) reveal(positions.current[value]);
  }, [value]);
  return (
    <Field label={label} error={error}>
      {options.length === 0 && empty ? <ThemedText type="small" themeColor="textSecondary">{empty}</ThemedText> : null}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cards}
        accessibilityRole="radiogroup"
        accessibilityLabel={label}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <PressableScale
              key={o.value}
              onPress={() => onChange(o.value)}
              onLayout={(e) => {
                positions.current[o.value] = e.nativeEvent.layout.x - t.space.three;
                if (selected) reveal(positions.current[o.value]);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${label}: ${o.label}, saldo ${o.balance}`}
              style={[
                styles.card,
                { backgroundColor: theme.backgroundElement, borderColor: selected ? theme.primaryText : theme.border },
                selected && styles.cardSelected,
              ]}>
              <IconCircle name={o.icon} color={theme.primaryText} size={t.avatar.sm} />
              <ThemedText type="small" numberOfLines={1}>{o.label}</ThemedText>
              <ThemedText type="smallBold" numberOfLines={1} style={styles.tabular}>{o.balance}</ThemedText>
            </PressableScale>
          );
        })}
      </ScrollView>
    </Field>
  );
}

/** Selección única con "chips" (rol radio). */
export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  hint,
  empty,
}: {
  label: string;
  options: Option<T>[];
  value: T | null;
  onChange: (v: T) => void;
  error?: string;
  hint?: string;
  empty?: string;
}) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <Field label={label} error={error} hint={hint}>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.length === 0 && empty ? (
          <ThemedText type="small" themeColor="textSecondary">{empty}</ThemedText>
        ) : null}
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <PressableScale
              key={o.value}
              onPress={() => onChange(o.value)}
              disabled={o.disabled}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: !!o.disabled }}
              accessibilityLabel={`${label}: ${o.label}`}
              style={[
                styles.chip,
                o.disabled && styles.disabled,
                {
                  backgroundColor: selected ? theme.primary + TINT : theme.backgroundElement,
                  borderColor: selected ? theme.primaryText : theme.border,
                },
              ]}>
              <ThemedText type="small" style={[{ color: selected ? theme.text : theme.textSecondary }, o.fontFamily ? { fontFamily: o.fontFamily } : null]}>
                {o.label}
              </ThemedText>
            </PressableScale>
          );
        })}
      </View>
    </Field>
  );
}

/** Fecha contable: Hoy / Ayer / Otra fecha (calendario propio, sin fechas futuras). */
export function DateField({ value, onChange, error }: { value: string; onChange: (iso: string) => void; error?: string }) {
  const [open, setOpen] = useState(false);
  const today = todayLocal();
  const yesterday = addDays(today, -1);
  const selected = value === today ? 'today' : value === yesterday ? 'yesterday' : 'other';

  return (
    <>
      <ChipGroup
        label="Fecha"
        options={[
          { value: 'today', label: 'Hoy' },
          { value: 'yesterday', label: 'Ayer' },
          { value: 'other', label: selected === 'other' ? formatShortDate(value) : 'Otra fecha' },
        ]}
        value={selected}
        onChange={(v) => (v === 'today' ? onChange(today) : v === 'yesterday' ? onChange(yesterday) : setOpen(true))}
        error={error}
      />
      <CalendarModal
        visible={open}
        value={value}
        onSelect={(iso) => {
          setOpen(false);
          onChange(iso);
        }}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

/** Una fecha que se toca para elegir otra en el calendario (p. ej. Desde / Hasta). */
export function CalendarField({
  label,
  value,
  onChange,
  error,
  max,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  error?: string;
  /** Último día elegible (por defecto hoy). */
  max?: string;
}) {
  const styles = useStyles();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Field label={label} error={error}>
      <PressableScale
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatLongDate(value)}`}
        accessibilityHint="Abre el calendario"
        style={[styles.input, { backgroundColor: theme.backgroundElement, borderColor: error ? theme.expense : theme.border }]}>
        <ThemedText>{formatShortDate(value)} {value.slice(0, 4)}</ThemedText>
      </PressableScale>
      <CalendarModal
        visible={open}
        value={value}
        max={max}
        onSelect={(iso) => {
          setOpen(false);
          onChange(iso);
        }}
        onCancel={() => setOpen(false)}
      />
    </Field>
  );
}

/**
 * Botón: deshabilitado mientras guarda (evita doble envío).
 * Jerarquía: un solo botón relleno por pantalla (`primary`, dorado); el resto con contorno:
 * `secondary` (dorado) y `danger` (rojo, solo para eliminar).
 */
export function PrimaryButton({
  label,
  onPress,
  busy,
  busyLabel = 'Guardando…',
  disabled,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  /** Texto mientras trabaja (p. ej. "Cifrando…"). */
  busyLabel?: string;
  /** Deshabilitado sin "Guardando…" (p. ej. Guardar sin cambios). */
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const styles = useStyles();
  const theme = useTheme();
  const look = {
    primary: { backgroundColor: theme.primary, borderColor: theme.primary, color: theme.onPrimary },
    secondary: { backgroundColor: 'transparent', borderColor: theme.primaryText, color: theme.primaryText },
    danger: { backgroundColor: 'transparent', borderColor: theme.expense, color: theme.expense },
  }[variant];
  return (
    <PressableScale
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(busy || disabled), busy: !!busy }}
      style={[styles.button, { backgroundColor: look.backgroundColor, borderColor: look.borderColor, opacity: busy || disabled ? 0.5 : 1 }]}>
      <ThemedText type="smallBold" style={{ color: look.color }}>
        {busy ? busyLabel : label}
      </ThemedText>
    </PressableScale>
  );
}

const useStyles = makeStyles((t) => ({
  field: { gap: t.space.one + t.space.half },
  input: {
    borderWidth: t.border.thin,
    borderRadius: t.radius.field,
    paddingHorizontal: t.space.three,
    paddingVertical: t.space.two + t.space.half,
    ...t.input,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.two },
  // Área táctil mínima (44 dp): con letra Pequeña o Compacta el chip no baja de ahí.
  chip: { borderWidth: t.border.thin, borderRadius: t.radius.pill, paddingHorizontal: t.space.three, paddingVertical: t.space.two, minHeight: t.size.touch, justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  amountBox: { alignItems: 'center', gap: t.space.one, paddingVertical: t.space.two },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: t.space.one },
  amountText: t.amount,
  amountInput: { minWidth: t.size.amountMinWidth, textAlign: 'center', fontVariant: ['tabular-nums'] },
  segments: { flexDirection: 'row', borderWidth: t.border.thin, borderRadius: t.radius.control, padding: t.space.half, gap: t.space.half },
  // Detrás de las opciones, dentro del relleno de la barra (se mueve con translateX).
  indicator: { position: 'absolute', top: t.space.half, bottom: t.space.half, left: t.space.half, borderRadius: t.radius.segment },
  segment: { borderRadius: t.radius.segment, minHeight: t.size.touch, alignItems: 'center', justifyContent: 'center', paddingHorizontal: t.space.one },
  cards: { gap: t.space.two, paddingVertical: t.space.half },
  card: { width: t.size.accountCard, borderWidth: t.border.thin, borderRadius: t.radius.tile, padding: t.space.three, gap: t.space.one },
  cardSelected: { borderWidth: t.border.selected },
  button: { borderRadius: t.radius.control, borderWidth: t.border.button, paddingVertical: t.space.three, paddingHorizontal: t.space.four, alignItems: 'center' },
}));
