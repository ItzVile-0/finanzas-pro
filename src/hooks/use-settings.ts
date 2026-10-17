import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Appearance } from 'react-native';

import { loadSettings, saveSettings } from '@/db/settings';
import { loadFont } from '@/constants/font-files';
import { DEFAULT_SETTINGS, type Settings, type ThemePref } from '@/domain/settings';
import { getAppearance, setAppearance } from '@/hooks/use-appearance';

/**
 * Cambia el tema de TODA la app al instante: cada useColorScheme (pantallas, navegación, barra inferior,
 * barra de estado) se vuelve a dibujar. En Android también cambia el modo noche nativo (calendario, alertas).
 */
export function applyTheme(theme: ThemePref) {
  Appearance.setColorScheme(theme === 'system' ? 'unspecified' : theme);
}

// Última fuente pedida por applyAppearance: si llegan dos seguidas (p. ej. restaurar y deshacer), gana la última.
let wantedFont = DEFAULT_SETTINGS.font;

/**
 * Tema y apariencia guardados, al instante (al iniciar, al restaurar y al deshacer una restauración). Nunca espera a la
 * red ni a un archivo: la fuente elegida se carga en segundo plano y se aplica cuando llega; mientras tanto (o si no
 * carga) se sigue con la que ya está, como mínimo Inter. Así el arranque no depende de la fuente.
 */
export function applyAppearance(s: Settings) {
  applyTheme(s.theme);
  wantedFont = s.font;
  setAppearance({ ...s, font: getAppearance().font });
  if (s.font === getAppearance().font) return;
  loadFont(s.font)
    .then(() => {
      if (wantedFont === s.font) setAppearance({ font: s.font });
    })
    .catch((e: unknown) => console.warn(`[apariencia] ${e instanceof Error ? e.message : String(e)}; se sigue con la fuente actual.`));
}

/** Lee los ajustes cada vez que la pantalla gana el foco (p. ej. al volver de Ajustes). */
export function useSettings() {
  const db = useSQLiteContext();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadSettings(db)
        .then((s) => {
          if (active) {
            setSettings(s);
            setLoaded(true);
            setError(null);
          }
        })
        .catch((e: unknown) => {
          if (active) {
            setLoaded(true); // se sigue con los valores por defecto, avisando
            setError(`No se pudieron leer los ajustes: ${e instanceof Error ? e.message : String(e)}`);
          }
        });
      return () => {
        active = false;
      };
    }, [db]),
  );

  /** Aplica el cambio al instante; si no se guarda, vuelve al valor anterior y deja el error. true = guardado. */
  async function save(patch: Partial<Settings>): Promise<boolean> {
    const previous = settings;
    const previousLook = getAppearance();
    if (patch.font) {
      try {
        await loadFont(patch.font); // antes de mostrarla: una familia sin cargar se vería con la fuente del sistema
      } catch (e) {
        setError(`No se pudo cargar la fuente: ${e instanceof Error ? e.message : String(e)}`);
        return false;
      }
    }
    setSettings({ ...previous, ...patch });
    if (patch.theme) applyTheme(patch.theme);
    setAppearance(patch);
    try {
      await saveSettings(db, patch);
      setError(null);
      return true;
    } catch (e) {
      setSettings(previous);
      if (patch.theme) applyTheme(previous.theme);
      setAppearance(previousLook);
      setError(`No se pudo guardar el ajuste: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }

  return { settings, loaded, error, save };
}
