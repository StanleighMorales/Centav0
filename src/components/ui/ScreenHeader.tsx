import React from 'react';
import { View, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Reanimated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { AppText } from './AppText';
import { useCalculator } from '../calculator/CalculatorOverlay';
import { theme, makeStyles, useTheme } from '../../theme';

type Props = {
  title: string;
  /** Fades the calculator out but keeps its space, so the title doesn't move. */
  calculatorHidden?: boolean;
};

// Screen title + calculator. The old "more" menu now lives in the tab bar's More slot.
export function ScreenHeader({ title, calculatorHidden = false }: Props) {
  const showCalculator = useCalculator();
  const styles = useStyles();
  const { colors } = useTheme();
  const fade = useAnimatedStyle(() => ({
    opacity: withTiming(calculatorHidden ? 0 : 1, { duration: (calculatorHidden ? theme.motion.exit : theme.motion.standard).duration }),
  }), [calculatorHidden]);

  return (
    <View style={styles.row}>
      <AppText variant="h1">{title}</AppText>
      <Reanimated.View
        style={fade}
        pointerEvents={calculatorHidden ? 'none' : 'auto'}
        accessibilityElementsHidden={calculatorHidden}
        importantForAccessibility={calculatorHidden ? 'no-hide-descendants' : 'auto'}
      >
        <Pressable
          onPress={() => showCalculator(true)}
          accessibilityRole="button"
          accessibilityLabel="Calculator"
          style={styles.iconBtn}
        >
          {/* Feather has no calculator glyph — same MaterialCommunityIcons fallback CategoryIcon uses. */}
          <MaterialCommunityIcons name="calculator" size={22} color={colors.textSecondary} />
        </Pressable>
      </Reanimated.View>
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
