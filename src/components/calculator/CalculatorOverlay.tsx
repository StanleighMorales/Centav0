import React, { createContext, useContext, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../ui/AppText';
import { theme, makeStyles, useTheme } from '../../theme';
import { initialCalc, press, type CalcKey } from '../../utils/calc';

// ponytail: the context carries the stable setState fn, so no provider memoisation is needed
const CalculatorContext = createContext<(visible: boolean) => void>(() => {});

export const useCalculator = () => useContext(CalculatorContext);

export function CalculatorProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  return (
    <CalculatorContext.Provider value={setVisible}>
      {children}
      {visible ? <Calculator onClose={() => setVisible(false)} /> : null}
    </CalculatorContext.Provider>
  );
}

const ROWS: CalcKey[][] = [
  ['C', 'back', '/', '*'],
  ['7', '8', '9', '-'],
  ['4', '5', '6', '+'],
  ['1', '2', '3', '='],
  ['0', '.'],
];

const GLYPH: Partial<Record<CalcKey, string>> = { '/': '÷', '*': '×', '-': '−' };

const A11Y: Partial<Record<CalcKey, string>> = {
  '/': 'Divide',
  '*': 'Multiply',
  '-': 'Minus',
  '+': 'Plus',
  '=': 'Equals',
  '.': 'Decimal point',
  C: 'Clear',
  back: 'Backspace',
};

// floating tab bar: 70px pill + bottom margin (src/components/nav/FloatingTabBar.tsx)
const TAB_BAR_HEIGHT = 82;

function Calculator({ onClose }: { onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [minimized, setMinimized] = useState(false);
  const [calc, setCalc] = useState(initialCalc);

  // ponytail: parked on the left so it never sits under a screen's FAB
  const bottom = TAB_BAR_HEIGHT + insets.bottom + theme.spacing[4];

  if (minimized) {
    return (
      <Pressable
        onPress={() => setMinimized(false)}
        accessibilityRole="button"
        accessibilityLabel={`Calculator, ${calc.display}. Expand`}
        style={({ pressed }) => [styles.bubble, { bottom }, pressed && styles.bubblePressed]}
      >
        <Feather name="maximize-2" size={14} color={colors.onAccent} />
        <AppText variant="amountSm" color="onAccent" numberOfLines={1} style={styles.bubbleValue}>
          {calc.display}
        </AppText>
      </Pressable>
    );
  }

  return (
    <View style={[styles.panel, { bottom }]}>
      <View style={styles.header}>
        <AppText variant="labelSm" color="textMuted">CALCULATOR</AppText>
        <View style={styles.headerActions}>
          <IconButton icon="minus" label="Minimize calculator" onPress={() => setMinimized(true)} />
          <IconButton icon="x" label="Close calculator" onPress={onClose} />
        </View>
      </View>

      <AppText variant="amountXs" color="textMuted" style={styles.alignRight} numberOfLines={1}>
        {calc.op && calc.prev !== null ? `${calc.prev} ${GLYPH[calc.op] ?? calc.op}` : ' '}
      </AppText>
      <AppText
        variant="amountLg"
        color={calc.display === 'Error' ? 'negative' : 'textPrimary'}
        style={[styles.alignRight, styles.display]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {calc.display}
      </AppText>

      {ROWS.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((key) => (
            <Key key={key} value={key} onPress={() => setCalc((s) => press(s, key))} />
          ))}
        </View>
      ))}
    </View>
  );
}

function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={theme.spacing[4]}
      style={({ pressed }) => (pressed ? styles.pressed : null)}
    >
      <Feather name={icon} size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

function Key({ value, onPress }: { value: CalcKey; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const isOperator = value === '+' || value === '-' || value === '*' || value === '/';
  const isEquals = value === '=';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={A11Y[value] ?? value}
      style={({ pressed }) => [
        styles.key,
        value === '0' && styles.keyWide,
        isOperator && styles.keyOperator,
        isEquals && styles.keyEquals,
        pressed && styles.pressed,
      ]}
    >
      {value === 'back' ? (
        <Feather name="delete" size={18} color={colors.textPrimary} />
      ) : (
        <AppText variant="h3" color={isEquals ? 'bgPrimary' : 'textPrimary'}>
          {GLYPH[value] ?? value}
        </AppText>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  panel: {
    position: 'absolute',
    left: theme.spacing[5],
    right: theme.spacing[5],
    backgroundColor: c.bgSurface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: c.borderDefault,
    padding: theme.spacing[4],
    gap: theme.spacing[3],
    ...theme.shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    gap: theme.spacing[6],
  },
  alignRight: { textAlign: 'right' },
  display: { marginBottom: theme.spacing[2] },
  row: {
    flexDirection: 'row',
    gap: theme.spacing[3],
  },
  key: {
    flex: 1,
    height: theme.spacing[10],
    borderRadius: theme.radius.md,
    backgroundColor: c.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyWide: { flex: 3 },
  keyOperator: { backgroundColor: c.bgElevated },
  keyEquals: { backgroundColor: c.accentPrimary },
  pressed: { opacity: 0.6 },
  bubble: {
    position: 'absolute',
    left: theme.spacing[5],
    maxWidth: '60%',
    minHeight: theme.spacing[10],
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    paddingHorizontal: theme.spacing[5],
    borderRadius: theme.radius.full,
    backgroundColor: c.accentPrimary,
    ...theme.shadows.md,
  },
  bubblePressed: { backgroundColor: c.accentDim },
  bubbleValue: { flexShrink: 1 },
}));
