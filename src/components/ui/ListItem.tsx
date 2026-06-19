import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText } from './AppText';
import { theme } from '../../theme';

type Props = {
  title: string;
  subtitle?: string;
  icon?: React.ComponentProps<typeof Feather>['name'];
  iconColor?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function ListItem({ title, subtitle, icon, iconColor, trailing, onPress, accessibilityLabel }: Props) {
  const content = (
    <View style={styles.row}>
      {icon ? (
        <View style={styles.iconWrap}>
          <Feather name={icon} size={18} color={iconColor ?? theme.colors.textSecondary} />
        </View>
      ) : null}
      <View style={styles.text}>
        <AppText variant="body">{title}</AppText>
        {subtitle ? (
          <AppText variant="bodySm" color="textSecondary">{subtitle}</AppText>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        style={({ pressed }) => [styles.item, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.item}>{content}</View>;
}

const styles = StyleSheet.create({
  item: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDefault,
    paddingVertical: theme.spacing[4],
  },
  pressed: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing[4],
  },
  text: { flex: 1, gap: theme.spacing[1] },
  trailing: { marginLeft: theme.spacing[4] },
});
