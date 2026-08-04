import React from 'react';
import { StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { BottomSheet } from '../ui/BottomSheet';
import { AppText } from '../ui/AppText';
import { theme } from '../../theme';

type MenuItemProps = {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
};

function MenuItem({ icon, label, onPress }: MenuItemProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Feather name={icon} size={20} color={theme.colors.textSecondary} />
      <AppText variant="body" style={styles.rowLabel}>{label}</AppText>
      <Feather name="chevron-right" size={18} color={theme.colors.textMuted} />
    </Pressable>
  );
}

type Props = { visible: boolean; onClose: () => void };

export function MoreMenuSheet({ visible, onClose }: Props) {
  const router = useRouter();

  function go(path: string) {
    onClose();
    router.push(path as any);
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="More">
      <AppText variant="labelSm" color="textMuted" style={styles.sectionLabel}>ACCOUNTS & CATEGORIES</AppText>
      <MenuItem icon="layers" label="Accounts" onPress={() => go('/accounts')} />
      <MenuItem icon="sliders" label="Account Types" onPress={() => go('/account-types')} />
      <MenuItem icon="tag" label="Categories" onPress={() => go('/categories')} />

      <AppText variant="labelSm" color="textMuted" style={[styles.sectionLabel, styles.sectionGap]}>ANALYTICS</AppText>
      <MenuItem icon="pie-chart" label="Budgets" onPress={() => go('/budgets')} />
      <MenuItem icon="bar-chart-2" label="Reports" onPress={() => go('/reports')} />

      <AppText variant="labelSm" color="textMuted" style={[styles.sectionLabel, styles.sectionGap]}>SETTINGS</AppText>
      <MenuItem icon="archive" label="Transaction Archive" onPress={() => go('/transaction-archive')} />

      <AppText variant="labelSm" color="textMuted" style={[styles.sectionLabel, styles.sectionGap]}>HELP</AppText>
      <MenuItem icon="help-circle" label="How to use Centav0" onPress={() => go('/onboarding/tutorial?replay=1')} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { letterSpacing: 0.8, marginBottom: theme.spacing[2] },
  sectionGap: { marginTop: theme.spacing[6] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[4],
    paddingVertical: theme.spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
  },
  pressed: { opacity: 0.6 },
  rowLabel: { flex: 1 },
});
