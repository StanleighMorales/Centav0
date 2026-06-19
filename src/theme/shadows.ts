import { Platform } from 'react-native';

const makeShadow = (
  color: string,
  offsetY: number,
  opacity: number,
  blurRadius: number,
  elevation: number,
) =>
  Platform.select({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: blurRadius,
    },
    android: { elevation },
    default: {},
  }) as object;

export const shadows = {
  none:     {},
  sm:       makeShadow('#000000', 1, 0.4, 3,  2),
  md:       makeShadow('#000000', 4, 0.5, 12, 6),
  lg:       makeShadow('#000000', 8, 0.6, 24, 12),
  goldGlow: makeShadow('#D4A017', 0, 0.2, 20, 8),
} as const;
