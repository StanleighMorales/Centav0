import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { AppText } from './AppText';
import { Button } from './Button';
import { theme } from '../../theme';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
};

export function ConfirmDialog({ visible, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel, destructive }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onCancel} title={title}>
      <AppText variant="body" color="textSecondary" style={styles.message}>
        {message}
      </AppText>
      <View style={styles.actions}>
        <Button label={cancelLabel} onPress={onCancel} variant="ghost" style={styles.btn} />
        <Button
          label={confirmLabel}
          onPress={onConfirm}
          variant={destructive ? 'secondary' : 'primary'}
          style={[styles.btn, destructive && styles.destructiveBtn]}
          accessibilityLabel={confirmLabel}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  message: { marginBottom: theme.spacing[6] },
  actions: { flexDirection: 'row', gap: theme.spacing[4] },
  btn: { flex: 1 },
  destructiveBtn: { borderColor: theme.colors.negative },
});
