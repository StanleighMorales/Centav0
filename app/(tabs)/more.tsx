import { View, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../../src/components/ui/AppText';
import { theme } from '../../src/theme';

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppText variant="h2" style={styles.title}>More</AppText>
      <Pressable
        onPress={() => router.push('/categories')}
        accessibilityRole="button"
        accessibilityLabel="Categories"
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Feather name="tag" size={20} color={theme.colors.textSecondary} />
        <AppText variant="body" style={styles.rowLabel}>Categories</AppText>
        <Feather name="chevron-right" size={18} color={theme.colors.textMuted} />
      </Pressable>
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
