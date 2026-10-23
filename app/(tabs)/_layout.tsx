import React, { useState } from 'react';
import { Tabs } from 'expo-router';
import { FloatingTabBar } from '../../src/components/nav/FloatingTabBar';
import { MoreMenuSheet } from '../../src/components/menu/MoreMenuSheet';
import { AddTransactionSheet } from '../../src/components/dashboard/AddTransactionSheet';
import { emitDataChanged } from '../../src/utils/dataEvents';
import { useTheme } from '../../src/theme';

export default function TabLayout() {
  const { colors } = useTheme();
  const [addOpen, setAddOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <Tabs
        tabBar={(props) => (
          <FloatingTabBar
            state={props.state}
            navigation={props.navigation}
            onAdd={() => setAddOpen(true)}
            onMore={() => setMoreOpen(true)}
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
      </Tabs>

      <AddTransactionSheet visible={addOpen} onClose={() => setAddOpen(false)} onSuccess={emitDataChanged} />
      <MoreMenuSheet visible={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
