import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { theme } from '../../theme';

export const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Spread onPressIn/onPressOut onto an AnimatedPressable and add `style` to its style array.
export function usePressScale(to = 0.97) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return {
    style,
    onPressIn: () => { scale.value = withTiming(to, theme.motion.micro); },
    onPressOut: () => { scale.value = withTiming(1, theme.motion.micro); },
  };
}
