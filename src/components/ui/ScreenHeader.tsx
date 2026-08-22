import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { MoreMenuSheet } from '../menu/MoreMenuSheet';
import { useCalculator } from '../calculator/CalculatorOverlay';
import { theme } from '../../theme';

type Props = { title: string };

export function ScreenHeader({ title }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const showCalculator = useCalculator();

  return (
    <View style={styles.row}>
      <AppText variant="h2">{title}</AppText>
      <View style={styles.actions}>
        <Pressable
          onPress={() => showCalculator(true)}
          accessibilityRole="button"
          accessibilityLabel="Calculator"
          style={styles.iconBtn}
        >
          {/* Feather has no calculator glyph — same MaterialCommunityIcons fallback CategoryIcon uses. */}
          <MaterialCommunityIcons name="calculator" size={22} color={theme.colors.textPrimary} />
        </Pressable>
        <Pressable
          onPress={() => setMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="More options"
          style={[styles.iconBtn, styles.menuBtn]}
        >
          <Feather name="more-vertical" size={22} color={theme.colors.textPrimary} />
        </Pressable>
      </View>
      <MoreMenuSheet visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBtn: { marginRight: -theme.spacing[2] },
});
