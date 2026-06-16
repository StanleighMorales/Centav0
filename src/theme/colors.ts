export const colors = {
  bgPrimary:     '#111111',
  bgSurface:     '#1A1A1A',
  bgElevated:    '#242424',
  bgInput:       '#1E1E1E',

  textPrimary:   '#F7F7F5',
  textSecondary: '#ABABAB',
  textMuted:     '#6E6E6E',
  textDisabled:  '#474747',

  accentPrimary: '#D4A017',
  accentDim:     '#B8860B',
  accentSubtle:  'rgba(212, 160, 23, 0.12)',
  accentBorder:  'rgba(212, 160, 23, 0.25)',

  borderDefault: '#2A2A2A',
  borderStrong:  '#3A3A3A',

  positive:      '#4CAF7D',
  negative:      '#E55353',
  warning:       '#F59E0B',
  info:          '#60A5FA',

  scrim:         'rgba(0, 0, 0, 0.65)',
  shimmer:       'rgba(212, 160, 23, 0.06)',
} as const;

export type ColorKey = keyof typeof colors;
