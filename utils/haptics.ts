
let isEnabled = true;

export const Haptics = {
  setEnabled: (enabled: boolean) => {
    isEnabled = enabled;
  },
  // Subtle tick for sliding/rotating interactions
  tick: () => {
    if (isEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
  },
  // Light tap for standard buttons/toggles
  light: () => {
    if (isEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15);
    }
  },
  // Medium bump for state changes (drill down, open menu)
  medium: () => {
    if (isEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(30);
    }
  },
  // Distinct success pattern (double tap)
  success: () => {
    if (isEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([10, 30, 20]);
    }
  },
  // Error or delete pattern
  error: () => {
    if (isEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([50, 30, 50]);
    }
  }
};