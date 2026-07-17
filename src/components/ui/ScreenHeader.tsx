import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText } from './AppText';
import { MoreMenuSheet } from '../menu/MoreMenuSheet';
import { theme } from '../../theme';

type Props = { title: string };

export function ScreenHeader({ title }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={styles.row}>
      <AppText variant="h2">{title}</AppText>
      <Pressable
        onPress={() => setMenuOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="More options"
        style={styles.menuBtn}
      >
        <Feather name="more-vertical" size={22} color={theme.colors.textPrimary} />
      </Pressable>
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
  menuBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -theme.spacing[2],
  },
});
