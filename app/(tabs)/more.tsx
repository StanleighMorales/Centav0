import { View, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../../src/components/ui/AppText';
import { theme } from '../../src/theme';

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

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <AppText variant="h2" style={styles.title}>More</AppText>

      <AppText variant="labelSm" color="textMuted" style={styles.sectionLabel}>ACCOUNTS & CATEGORIES</AppText>
      <MenuItem icon="layers" label="Accounts" onPress={() => router.push('/accounts')} />
      <MenuItem icon="tag" label="Categories" onPress={() => router.push('/categories')} />

      <AppText variant="labelSm" color="textMuted" style={[styles.sectionLabel, styles.sectionGap]}>ANALYTICS</AppText>
      <MenuItem icon="pie-chart" label="Budgets" onPress={() => router.push('/budgets')} />
      <MenuItem icon="bar-chart-2" label="Reports" onPress={() => router.push('/reports')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
    paddingHorizontal: theme.spacing[5],
  },
  title: { marginTop: theme.spacing[7], marginBottom: theme.spacing[5] },
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
