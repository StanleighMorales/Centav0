import React from 'react';
import { View, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { useCalculator } from '../calculator/CalculatorOverlay';
import { makeStyles, useTheme } from '../../theme';

type Props = { title: string };

// Screen title + calculator. The old "more" menu now lives in the tab bar's More slot.
export function ScreenHeader({ title }: Props) {
  const showCalculator = useCalculator();
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <AppText variant="h1">{title}</AppText>
      <Pressable
        onPress={() => showCalculator(true)}
        accessibilityRole="button"
        accessibilityLabel="Calculator"
        style={styles.iconBtn}
      >
        {/* Feather has no calculator glyph — same MaterialCommunityIcons fallback CategoryIcon uses. */}
        <MaterialCommunityIcons name="calculator" size={22} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: c.borderDefault,
    backgroundColor: c.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
