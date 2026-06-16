export const typography = {
  displayLg: { fontFamily: 'Cormorant_700Bold',     fontSize: 48, lineHeight: 52, letterSpacing: -0.5 },
  displayMd: { fontFamily: 'Cormorant_600SemiBold',  fontSize: 36, lineHeight: 40, letterSpacing: -0.3 },
  displaySm: { fontFamily: 'Cormorant_600SemiBold',  fontSize: 28, lineHeight: 32, letterSpacing: -0.2 },

  h1: { fontFamily: 'Cormorant_700Bold',    fontSize: 32, lineHeight: 36, letterSpacing: -0.2 },
  h2: { fontFamily: 'DMSans_600SemiBold',   fontSize: 22, lineHeight: 28, letterSpacing: 0   },
  h3: { fontFamily: 'DMSans_600SemiBold',   fontSize: 18, lineHeight: 24, letterSpacing: 0   },
  h4: { fontFamily: 'DMSans_500Medium',     fontSize: 16, lineHeight: 22, letterSpacing: 0   },

  bodyLg: { fontFamily: 'DMSans_400Regular', fontSize: 18, lineHeight: 28, letterSpacing: 0   },
  body:   { fontFamily: 'DMSans_400Regular', fontSize: 16, lineHeight: 24, letterSpacing: 0   },
  bodySm: { fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 20, letterSpacing: 0.1 },

  labelLg: { fontFamily: 'DMSans_500Medium', fontSize: 14, lineHeight: 18, letterSpacing: 0.3 },
  label:   { fontFamily: 'DMSans_500Medium', fontSize: 12, lineHeight: 16, letterSpacing: 0.5 },
  labelSm: { fontFamily: 'DMSans_500Medium', fontSize: 11, lineHeight: 14, letterSpacing: 0.8 },

  amountXl: { fontFamily: 'DMMono_500Medium', fontSize: 32, lineHeight: 36, letterSpacing: -0.5 },
  amountLg: { fontFamily: 'DMMono_500Medium', fontSize: 24, lineHeight: 28, letterSpacing: -0.3 },
  amountMd: { fontFamily: 'DMMono_500Medium', fontSize: 18, lineHeight: 24, letterSpacing: 0   },
  amountSm: { fontFamily: 'DMMono_500Medium', fontSize: 14, lineHeight: 18, letterSpacing: 0   },
  amountXs: { fontFamily: 'DMMono_500Medium', fontSize: 12, lineHeight: 16, letterSpacing: 0   },
} as const;

export type TypographyKey = keyof typeof typography;
