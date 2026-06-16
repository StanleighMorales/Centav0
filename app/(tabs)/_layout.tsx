import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../src/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.bgSurface,
          borderTopColor: theme.colors.borderDefault,
          borderTopWidth: 1,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarActiveTintColor: theme.colors.accentPrimary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarLabelStyle: {
          ...theme.typography.labelSm,
          marginBottom: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home tab',
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size ?? 20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarAccessibilityLabel: 'Transactions tab',
          tabBarIcon: ({ color, size }) => (
            <Feather name="list" size={size ?? 20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="debts"
        options={{
          title: 'Debts',
          tabBarAccessibilityLabel: 'Debts tab',
          tabBarIcon: ({ color, size }) => (
            <Feather name="credit-card" size={size ?? 20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarAccessibilityLabel: 'More tab',
          tabBarIcon: ({ color, size }) => (
            <Feather name="menu" size={size ?? 20} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
