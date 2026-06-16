import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../src/components/ui/AppText';
import { theme } from '../../src/theme';

export default function DebtsScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppText variant="h2" style={styles.title}>Debts</AppText>
      <AppText variant="bodySm" color="textMuted">Coming in Phase 8</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
    paddingHorizontal: theme.spacing[5],
  },
  title: { marginTop: theme.spacing[7], marginBottom: theme.spacing[3] },
});
