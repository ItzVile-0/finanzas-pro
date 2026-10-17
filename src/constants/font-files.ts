// Archivos de las 7 fuentes: cada peso por su ruta (`.../400Regular`), no la raíz del paquete, que pide los 18 pesos
// con cursivas y los mete todos en el APK (solo Inter eran 6 MB). Al iniciar se carga solo la fuente elegida.
import { loadAsync } from 'expo-font';

import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { Poppins_500Medium } from '@expo-google-fonts/poppins/500Medium';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';
import { Poppins_700Bold } from '@expo-google-fonts/poppins/700Bold';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_600SemiBold } from '@expo-google-fonts/dm-sans/600SemiBold';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_500Medium } from '@expo-google-fonts/nunito/500Medium';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { SpaceGrotesk_400Regular } from '@expo-google-fonts/space-grotesk/400Regular';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium';
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk/600SemiBold';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { Lora_400Regular } from '@expo-google-fonts/lora/400Regular';
import { Lora_500Medium } from '@expo-google-fonts/lora/500Medium';
import { Lora_600SemiBold } from '@expo-google-fonts/lora/600SemiBold';
import { Lora_700Bold } from '@expo-google-fonts/lora/700Bold';

import type { FontKey } from '@/domain/settings';
import { withTimeout } from '@/domain/timeout';

import { fontFamilies } from './tokens';

const FILES: Record<FontKey, [number, number, number, number]> = {
  inter: [Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold],
  manrope: [Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold],
  poppins: [Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold],
  'dm-sans': [DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold],
  nunito: [Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold],
  'space-grotesk': [SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold],
  lora: [Lora_400Regular, Lora_500Medium, Lora_600SemiBold, Lora_700Bold],
};

/** { familia: archivo } de los 4 pesos, para useFonts/loadAsync. */
export function fontMap(font: FontKey): Record<string, number> {
  const f = fontFamilies(font);
  const [regular, medium, semibold, bold] = FILES[font];
  return { [f.regular]: regular, [f.medium]: medium, [f.semibold]: semibold, [f.bold]: bold };
}

/** Tiempo máximo para cargar una fuente: por el túnel de Expo Go un archivo puede no llegar nunca. */
export const FONT_TIMEOUT_MS = 6000;

/**
 * Registra los 4 pesos de la fuente (expo-font no vuelve a cargar lo que ya está). Falla si un archivo no carga o si
 * tarda más de FONT_TIMEOUT_MS: quien llama sigue con Inter y el arranque nunca queda esperando.
 */
export const loadFont = (font: FontKey): Promise<void> => withTimeout(loadAsync(fontMap(font)), FONT_TIMEOUT_MS, `Fuente ${font}`);
