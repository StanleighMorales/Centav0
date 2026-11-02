import React from 'react';
import { Text, TextProps } from 'react-native';
import { theme, useTheme } from '../../theme';
import type { ColorKey, TypographyKey } from '../../theme';

type Props = TextProps & {
  variant?: TypographyKey;
  color?: ColorKey;
};

export function AppText({ variant = 'body', color = 'textPrimary', style, children, ...rest }: Props) {
  const { colors } = useTheme();
  // Gold text uses the darker accentText so it keeps AA contrast on the light theme.
  const resolved = color === 'accentPrimary' ? colors.accentText : colors[color];
  return (
    <Text style={[theme.typography[variant], { color: resolved }, style]} {...rest}>
      {children}
    </Text>
  );
}
