import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** true mientras TalkBack (o VoiceOver) está activo. */
export function useScreenReader() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((v) => {
      if (active) setOn(v);
    });
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  return on;
}
