import React from 'react';
import { View, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { BottomSheet } from '../ui/BottomSheet';
import { AppText } from '../ui/AppText';
import { theme, makeStyles, useTheme } from '../../theme';

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

type Props = { visible: boolean; onClose: () => void };

export function MoreMenuSheet({ visible, onClose }: Props) {
  const styles = useStyles();
  const router = useRouter();
  const { height } = useWindowDimensions();

  function go(path: string) {
    onClose();
    router.push(path as any);
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="More">
      <ScrollView style={{ maxHeight: height * 0.68 }} showsVerticalScrollIndicator={false}>
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
    </BottomSheet>
  );
}

const useStyles = makeStyles((c) => ({
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
