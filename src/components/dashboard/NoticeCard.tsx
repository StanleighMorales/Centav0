import React from 'react';
import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../ui/AppText';
import { theme, makeStyles, useTheme } from '../../theme';

type Props = {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  lines: string[];
  onPress: () => void;
};

export function NoticeCard({ icon, title, lines, onPress }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${lines.join('. ')}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Feather name={icon} size={18} color={colors.warning} />
      <View style={styles.text}>
        <AppText variant="labelLg">{title}</AppText>
        {lines.map((line, i) => (
          <AppText key={i} variant="bodySm" color="textSecondary">{line}</AppText>
        ))}
      </View>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    backgroundColor: c.warningBg,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[5],
  },
  pressed: { opacity: 0.6 },
  text: { flex: 1, gap: theme.spacing[1] },
}));
