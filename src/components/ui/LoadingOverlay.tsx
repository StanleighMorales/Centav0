import React from 'react';
import { View, ActivityIndicator, Modal } from 'react-native';
import { makeStyles, useTheme } from '../../theme';

type Props = { visible: boolean };

export function LoadingOverlay({ visible }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.backdrop}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: {
    flex: 1,
    backgroundColor: c.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
