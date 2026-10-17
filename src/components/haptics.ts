import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { getAppearance } from '@/hooks/use-appearance';

// Android: performAndroidHapticsAsync usa el motor háptico del sistema, que respeta el ajuste "Respuesta táctil"
// del teléfono (sin permiso VIBRATE). iOS: el generador háptico del sistema, que respeta el suyo.
// No depende de "reducir animaciones": esa opción es sobre movimiento en pantalla, no sobre vibración.
const android = Platform.OS === 'android';

// Un teléfono sin motor háptico rechaza la promesa: no es un error para el usuario, se ignora.
// Con Vibración desactivada (Apariencia) no se llama al motor.
const run = (vibrate: () => Promise<void>) => {
  if (getAppearance().haptics) vibrate().catch(() => {});
};

export const haptics = {
  /** Algo se guardó. */
  success: () =>
    run(() => android ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm) : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Algo se eliminó. */
  warning: () =>
    run(() => android ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject) : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** Un interruptor cambió. */
  toggle: (on: boolean) =>
    run(() => android ? Haptics.performAndroidHapticsAsync(on ? Haptics.AndroidHaptics.Toggle_On : Haptics.AndroidHaptics.Toggle_Off) : Haptics.selectionAsync()),
  /** Cambió la opción de un selector segmentado. */
  selection: () => run(() => android ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick) : Haptics.selectionAsync()),
};
