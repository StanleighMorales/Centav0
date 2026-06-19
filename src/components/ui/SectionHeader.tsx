import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { theme } from '../../theme';

type Props = { title: string; action?: React.ReactNode };

export function SectionHeader({ title, action }: Props) {
  return (
    <View style={styles.row}>
      <AppText variant="label" color="textSecondary" style={styles.title}>
        {title.toUpperCase()}
      </AppText>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing[4],
  },
  title: { letterSpacing: 1.2 },
});
