import React, { useState } from 'react';
import { View } from 'react-native';
import { AnimatedPressable, usePressScale } from './usePressScale';
import { Feather } from '@expo/vector-icons';
import { AppText } from './AppText';
import { theme, makeStyles, useTheme } from '../../theme';

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
  const styles = useStyles();
  const { colors } = useTheme();
  const [pressed, setPressed] = useState(false);
  const press = usePressScale(0.98);
  const content = (
    <View style={styles.row}>
      {icon ? (
        <View style={styles.iconWrap}>
          <Feather name={icon} size={18} color={iconColor ?? colors.textSecondary} />
        </View>
      ) : null}
      <View style={styles.text}>
        <AppText variant="h4" numberOfLines={1}>{title}</AppText>
        {subtitle ? (
          <AppText variant="bodySm" color="textSecondary">{subtitle}</AppText>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => { setPressed(true); press.onPressIn(); }}
        onPressOut={() => { setPressed(false); press.onPressOut(); }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        style={[styles.item, pressed && styles.pressed, press.style]}
      >
        {content}
      </AnimatedPressable>
    );
  }

  return <View style={styles.item}>{content}</View>;
}

const useStyles = makeStyles((c) => ({
  item: {
    borderBottomWidth: 1,
    borderBottomColor: c.borderDefault,
    paddingVertical: theme.spacing[4],
  },
  pressed: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.md,
    backgroundColor: c.bgElevated,
    borderWidth: 1,
    borderColor: c.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing[4],
  },
  text: { flex: 1, gap: theme.spacing[1] },
  trailing: { marginLeft: theme.spacing[4] },
}));
