import React from 'react';
import { View, ActivityIndicator, StyleSheet, Modal } from 'react-native';
import { theme } from '../../theme';

type Props = { visible: boolean };

export function LoadingOverlay({ visible }: Props) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.backdrop}>
        <ActivityIndicator size="large" color={theme.colors.accentPrimary} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
