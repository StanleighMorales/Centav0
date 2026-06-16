import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText } from './AppText';
import { Button } from './Button';
import { theme } from '../../theme';

type Props = {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
};

export function EmptyState({ icon, title, subtitle, ctaLabel, onCta }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Feather name={icon} size={32} color={theme.colors.textMuted} />
      </View>
      <AppText variant="h3" style={styles.title}>{title}</AppText>
      {subtitle ? (
        <AppText variant="bodySm" color="textSecondary" style={styles.subtitle}>{subtitle}</AppText>
      ) : null}
      {ctaLabel && onCta ? (
        <Button label={ctaLabel} onPress={onCta} variant="secondary" style={styles.cta} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing[10],
    paddingHorizontal: theme.spacing[8],
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing[5],
  },
  title: { textAlign: 'center', marginBottom: theme.spacing[2] },
  subtitle: { textAlign: 'center', marginBottom: theme.spacing[5] },
  cta: { minWidth: 160 },
});
