import React from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../../src/components/ui/AppText';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { TAB_BAR_SPACE } from '../../src/components/nav/FloatingTabBar';
import { theme, makeStyles, useTheme } from '../../src/theme';

type Icon = React.ComponentProps<typeof Feather>['name'];

function MenuRow({ icon, label, hint, onPress }: { icon: Icon; label: string; hint?: string; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.iconTile}>
        <Feather name={icon} size={18} color={colors.accentText} />
      </View>
      <View style={styles.rowText}>
        <AppText variant="h4">{label}</AppText>
        {hint ? <AppText variant="bodySm" color="textMuted">{hint}</AppText> : null}
      </View>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function PlanTile({ icon, label, onPress }: { icon: Icon; label: string; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <Feather name={icon} size={22} color={colors.accentText} />
      <AppText variant="h4">{label}</AppText>
    </Pressable>
  );
}

export default function MoreScreen() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function go(path: string) {
    router.push(path as any);
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + theme.spacing[4], paddingHorizontal: theme.spacing[5], paddingBottom: TAB_BAR_SPACE + insets.bottom }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}><ScreenHeader title="More" /></View>
<AppText variant="labelSm" color="textMuted" style={styles.sectionLabel}>SETUP</AppText>
      <View style={styles.group}>
        <MenuRow icon="layers" label="Accounts" onPress={() => go('/accounts')} />
        <MenuRow icon="sliders" label="Account Types" onPress={() => go('/account-types')} />
        <MenuRow icon="tag" label="Categories" onPress={() => go('/categories')} />
      </View>

      <AppText variant="labelSm" color="textMuted" style={[styles.sectionLabel, styles.sectionGap]}>PLAN &amp; ANALYSE</AppText>
      <View style={styles.tiles}>
        <PlanTile icon="pie-chart" label="Budgets" onPress={() => go('/budgets')} />
        <PlanTile icon="repeat" label="Recurring" onPress={() => go('/recurring')} />
        <PlanTile icon="bar-chart-2" label="Reports" onPress={() => go('/reports')} />
      </View>

      <AppText variant="labelSm" color="textMuted" style={[styles.sectionLabel, styles.sectionGap]}>DATA &amp; APP</AppText>
      <View style={styles.group}>
        <MenuRow icon="archive" label="Transaction Archive" hint="Deleted items" onPress={() => go('/transaction-archive')} />
        <MenuRow icon="settings" label="Settings" hint="Appearance, backup, reset" onPress={() => go('/settings')} />
        <MenuRow icon="help-circle" label="How to use Centav0" onPress={() => go('/onboarding/tutorial?replay=1')} />
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.bgPrimary },
  header: { marginBottom: theme.spacing[5] },
  sectionLabel: { letterSpacing: 1.2, marginBottom: theme.spacing[3] },
  sectionGap: { marginTop: theme.spacing[6] },
  group: {
    backgroundColor: c.bgElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: c.borderDefault,
    paddingHorizontal: theme.spacing[4],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[4],
    minHeight: 56,
    paddingVertical: theme.spacing[3],
  },
  rowText: { flex: 1 },
  iconTile: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.md,
    backgroundColor: c.bgSurface,
    borderWidth: 1,
    borderColor: c.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  tiles: { flexDirection: 'row', gap: theme.spacing[3] },
  tile: {
    flex: 1,
    minHeight: 88,
    gap: theme.spacing[3],
    justifyContent: 'space-between',
    padding: theme.spacing[4],
    backgroundColor: c.bgElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: c.borderDefault,
  },
}));
