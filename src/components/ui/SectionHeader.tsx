import React from 'react';
import { View } from 'react-native';
import { AppText } from './AppText';
import { theme, makeStyles } from '../../theme';

type Props = { title: string; action?: React.ReactNode };

export function SectionHeader({ title, action }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <AppText variant="label" color="textSecondary" style={styles.title}>
        {title.toUpperCase()}
      </AppText>
      {action}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing[4],
  },
  title: { letterSpacing: 1.2 },
}));
