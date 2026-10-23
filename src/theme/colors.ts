// Obsidian (dark) and Ivory (light), designed as a pair — see the redesign canvas.
// Gold fills (accentPrimary) are for buttons/indicators; use accentText for gold *text* so it passes AA on light.
export const darkColors = {
  bgPrimary:     '#0B0B0C',
  bgSurface:     '#141416',
  bgElevated:    '#1C1C1F',
  bgInput:       '#1C1C1F',

  textPrimary:   '#F4F1EA',
  textSecondary: '#A9A59B',
  textMuted:     '#8C887E',
  textDisabled:  '#5A5750',

  accentPrimary: '#E2B24C',
  accentDim:     '#C99A2E',
  accentText:    '#E2B24C',
  onAccent:      '#1A1405',
  accentSubtle:  'rgba(226, 178, 76, 0.13)',
  accentBorder:  'rgba(226, 178, 76, 0.30)',
  heroFrom:      '#241E10',
  heroTo:        '#141416',

  borderDefault: '#2A2A2E',
  borderStrong:  '#3A3A3F',

  positive:      '#5FC48F',
  negative:      '#F07178',
  warning:       '#F2A93B',
  info:          '#6BAFF5',
  positiveBg:    'rgba(95, 196, 143, 0.13)',
  negativeBg:    'rgba(240, 113, 120, 0.13)',
  warningBg:     'rgba(242, 169, 59, 0.14)',

  scrim:         'rgba(0, 0, 0, 0.6)',
  shimmer:       'rgba(226, 178, 76, 0.06)',
} as const;

export type Colors = { [K in keyof typeof darkColors]: string };

export const lightColors: Colors = {
  bgPrimary:     '#F4F1E9',
  bgSurface:     '#FFFFFF',
  bgElevated:    '#FBF9F4',
  bgInput:       '#FBF9F4',

  textPrimary:   '#16130C',
  textSecondary: '#57524A',
  textMuted:     '#6F695D',
  textDisabled:  '#A8A397',

  accentPrimary: '#C99A2E',
  accentDim:     '#A87F1F',
  accentText:    '#7A5604',
  onAccent:      '#1A1405',
  accentSubtle:  'rgba(201, 154, 46, 0.15)',
  accentBorder:  'rgba(122, 86, 4, 0.28)',
  heroFrom:      '#FFF3D2',
  heroTo:        '#FFFFFF',

  borderDefault: '#E4DFD2',
  borderStrong:  '#CFC8B6',

  positive:      '#15744A',
  negative:      '#B3261E',
  warning:       '#8F5200',
  info:          '#1F5FA8',
  positiveBg:    'rgba(21, 116, 74, 0.10)',
  negativeBg:    'rgba(179, 38, 30, 0.09)',
  warningBg:     'rgba(143, 82, 0, 0.11)',

  scrim:         'rgba(22, 19, 12, 0.45)',
  shimmer:       'rgba(122, 86, 4, 0.06)',
};

// Static dark palette: kept so files not yet moved to useTheme() still compile (they stay dark).
export const colors: Colors = darkColors;

export type ColorKey = keyof Colors;
