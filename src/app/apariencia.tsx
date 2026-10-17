import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { FitText } from '@/components/fit-text';
import { ChipGroup, FormScroll, PrimaryButton, TextField, type Option } from '@/components/form';
import { Greeting } from '@/components/greeting';
import { haptics } from '@/components/haptics';
import { DOWN, MovementRow, UP } from '@/components/movement-row';
import { Figure } from '@/components/panel';
import { ThemedText } from '@/components/themed-text';
import { loadFont } from '@/constants/font-files';
import { fontFamilies, FONT_META } from '@/constants/tokens';
import { todayLocal } from '@/domain/dates';
import type { Transaction } from '@/domain/ledger';
import { formatCOP } from '@/domain/money';
import {
  APPEARANCE_DEFAULTS,
  FONTS,
  USER_NAME_MAX,
  type Accent,
  type Animations,
  type Corners,
  type Density,
  type TextScale,
  type ThemePref,
} from '@/domain/settings';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { makeStyles } from '@/hooks/use-tokens';

const THEMES: Option<ThemePref>[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];
const ACCENTS: Option<Accent>[] = [
  { value: 'gold', label: 'Dorado' },
  { value: 'silver', label: 'Plata' },
  { value: 'emerald', label: 'Esmeralda' },
  { value: 'copper', label: 'Cobre' },
  { value: 'sapphire', label: 'Azul zafiro' },
];
const SIZES: Option<TextScale>[] = [
  { value: 'small', label: 'Pequeño' },
  { value: 'normal', label: 'Normal' },
  { value: 'large', label: 'Grande' },
  { value: 'xlarge', label: 'Muy grande' },
];
const DENSITY: Option<Density>[] = [
  { value: 'compact', label: 'Compacta' },
  { value: 'normal', label: 'Normal' },
  { value: 'comfortable', label: 'Amplia' },
];
const MOTION: Option<Animations>[] = [
  { value: 'full', label: 'Completas' },
  { value: 'soft', label: 'Suaves' },
  { value: 'off', label: 'Desactivadas' },
];
const VIBRATION: Option<'on' | 'off'>[] = [
  { value: 'on', label: 'Activada' },
  { value: 'off', label: 'Desactivada' },
];
const CORNER: Option<Corners>[] = [
  { value: 'rounded', label: 'Redondeadas' },
  { value: 'soft', label: 'Suaves' },
  { value: 'straight', label: 'Rectas' },
];

// Movimiento de muestra para la vista previa (no se guarda).
const SAMPLE: Transaction = {
  id: 'vista-previa', scope: 'personal', kind: 'expense', amount: 85_000, date: todayLocal(), account_id: '', to_account_id: null,
  category_id: null, note: 'Mercado de la semana', created_at: '',
};

/** Apariencia con vista previa en vivo: cada cambio se aplica a toda la app y se guarda al instante. */
export default function AppearanceScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const { settings, loaded, error, save } = useSettings();
  const [name, setName] = useState<string | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const shownName = name ?? settings.userName;

  // Cada opción de fuente se muestra en su fuente: se cargan todas al abrir (las que fallen se ven en la actual).
  useEffect(() => {
    let active = true;
    void Promise.allSettled(FONTS.map(loadFont)).then(() => {
      if (active) setFontsReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const fonts: Option<(typeof FONTS)[number]>[] = FONTS.map((f) => ({
    value: f,
    label: FONT_META[f].label,
    fontFamily: fontsReady ? fontFamilies(f).semibold : undefined,
  }));
  const enabled = <T extends string>(list: Option<T>[]) => list.map((o) => ({ ...o, disabled: !loaded }));

  return (
    <FormScroll contentStyle={styles.content}>
      {error ? (
        <ThemedText type="small" style={{ color: theme.expense }} accessibilityRole="alert">{error}</ThemedText>
      ) : null}

      <View
        style={[styles.preview, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
        accessible
        accessibilityLabel="Vista previa de la apariencia elegida">
        <ThemedText type="caption" themeColor="textSecondary">VISTA PREVIA</ThemedText>
        {shownName.trim() ? <Greeting name={shownName.trim()} /> : null}
        <View style={[styles.balance, { backgroundColor: theme.highlight, borderColor: theme.primaryBorder }]}>
          <ThemedText type="caption" themeColor="textSecondary">SALDO TOTAL</ThemedText>
          <FitText style={styles.amount}>{formatCOP(12_345_678)}</FitText>
          <View style={styles.row}>
            <Figure icon={UP} color={theme.income} label="Ingresos" value={formatCOP(4_200_000)} />
            <Figure icon={DOWN} color={theme.expense} label="Gastos" value={formatCOP(1_850_000)} />
          </View>
        </View>
        <MovementRow tx={SAMPLE} />
        <View style={[styles.sampleButton, { backgroundColor: theme.primary }]}>
          <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>Guardar</ThemedText>
        </View>
      </View>

      <TextField
        label="¿Cómo quieres que te llame?"
        hint={`Se muestra en el Inicio como "Hola, …". Vacío = sin saludo. Máximo ${USER_NAME_MAX} caracteres.`}
        value={shownName}
        maxLength={USER_NAME_MAX}
        autoCapitalize="words"
        editable={loaded}
        onChangeText={(v) => {
          setName(v);
          void save({ userName: v }); // se guarda sin espacios a los lados (normalizeUserName)
        }}
      />

      <ChipGroup label="Tema" options={enabled(THEMES)} value={settings.theme} onChange={(theme) => save({ theme })} />
      <ChipGroup
        label="Color de acento"
        options={enabled(ACCENTS)}
        value={settings.accent}
        onChange={(accent) => save({ accent })}
        hint="Botones, enlaces e íconos. La tienda conserva su rosa."
      />
      <ChipGroup label="Fuente" options={enabled(fonts)} value={settings.font} onChange={(font) => save({ font })} />
      <ChipGroup
        label="Tamaño de letra"
        options={enabled(SIZES)}
        value={settings.textScale}
        onChange={(textScale) => save({ textScale })}
        hint="Se suma al tamaño de letra del teléfono, con un tope para que nada se salga de la pantalla."
      />
      <ChipGroup label="Densidad de tarjetas" options={enabled(DENSITY)} value={settings.density} onChange={(density) => save({ density })} />
      <ChipGroup label="Esquinas" options={enabled(CORNER)} value={settings.corners} onChange={(corners) => save({ corners })} />

      <ChipGroup
        label="Animaciones"
        options={enabled(MOTION)}
        value={settings.animations}
        onChange={(animations) => save({ animations })}
        hint={'Suaves: solo aparecen y desaparecen, más rápido. Si el teléfono tiene "Quitar animaciones", se desactivan siempre.'}
      />
      <ChipGroup
        label="Vibración"
        options={enabled(VIBRATION)}
        value={settings.haptics ? 'on' : 'off'}
        onChange={(v) => {
          void save({ haptics: v === 'on' }).then((ok) => {
            if (ok && v === 'on') haptics.toggle(true); // se siente al activarla
          });
        }}
        hint="Al guardar, eliminar y cambiar de opción."
      />

      <PrimaryButton label="Restablecer apariencia" variant="secondary" onPress={() => setConfirmReset(true)} disabled={!loaded} />

      <ConfirmDialog
        visible={confirmReset}
        title="¿Restablecer la apariencia?"
        message="Vuelven el tema del sistema, el dorado, Inter, el tamaño Normal, la densidad Normal y las esquinas redondeadas. Tu nombre, las animaciones y la vibración no cambian."
        confirmLabel="Restablecer"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          void save(APPEARANCE_DEFAULTS);
        }}
      />
    </FormScroll>
  );
}

const useStyles = makeStyles((t) => ({
  content: { padding: t.space.three, gap: t.space.four, width: '100%', maxWidth: t.size.maxContent, alignSelf: 'center' },
  // Solo para mirar: no responde a toques (el botón de muestra no es un botón).
  preview: { pointerEvents: 'none', padding: t.space.three, gap: t.space.three, borderRadius: t.radius.card, borderWidth: t.border.thin },
  balance: { padding: t.space.three, gap: t.space.two, borderRadius: t.radius.card, borderWidth: t.border.thin },
  amount: { fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.two },
  sampleButton: { borderRadius: t.radius.control, paddingVertical: t.space.three, alignItems: 'center' },
}));
