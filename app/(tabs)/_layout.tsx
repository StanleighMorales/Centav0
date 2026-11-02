import React, { useState } from 'react';
import { Tabs } from 'expo-router';
import { FloatingTabBar } from '../../src/components/nav/FloatingTabBar';
import { AddTransactionSheet } from '../../src/components/dashboard/AddTransactionSheet';
import { emitDataChanged } from '../../src/utils/dataEvents';
import { useTheme } from '../../src/theme';

export default function TabLayout() {
  const { colors } = useTheme();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <Tabs
        tabBar={(props) => (
          <FloatingTabBar
            state={props.state}
            navigation={props.navigation}
            onAdd={() => setAddOpen(true)}
          />
        )}
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          sceneStyle: { backgroundColor: colors.bgPrimary },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="transactions" options={{ title: 'Activity' }} />
        <Tabs.Screen name="ledger" options={{ title: 'Ledger' }} />
        <Tabs.Screen name="more" options={{ title: 'More' }} />
      </Tabs>

      <AddTransactionSheet visible={addOpen} onClose={() => setAddOpen(false)} onSuccess={emitDataChanged} />
    </>
  );
}
