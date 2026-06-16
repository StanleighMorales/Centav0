import React from 'react';
import { Text, TextProps } from 'react-native';
import { theme } from '../../theme';
import type { ColorKey, TypographyKey } from '../../theme';

type Props = TextProps & {
  variant?: TypographyKey;
  color?: ColorKey;
};

export function AppText({ variant = 'body', color = 'textPrimary', style, children, ...rest }: Props) {
  return (
    <Text style={[theme.typography[variant], { color: theme.colors[color] }, style]} {...rest}>
      {children}
    </Text>
  );
}
