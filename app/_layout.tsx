import 'react-native-gesture-handler';
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, useRouter } from 'expo-router';
import { ThemeProvider, DarkTheme, DefaultTheme } from 'expo-router/react-navigation';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Cormorant_400Regular,
  Cormorant_600SemiBold,
  Cormorant_700Bold,
} from '@expo-google-fonts/cormorant';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from '@expo-google-fonts/dm-sans';
import { DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import * as SplashScreen from 'expo-splash-screen';
import { getDatabase } from '../src/db/database';
import { accountRepo } from '../src/repositories';
import { materializeRecurringTransactions } from '../src/db/recurring';
import { CalculatorProvider } from '../src/components/calculator/CalculatorOverlay';
import { theme, AppThemeProvider, useTheme } from '../src/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [hasAccounts, setHasAccounts] = useState<boolean | null>(null);

  const [fontsLoaded] = useFonts({
    Cormorant_400Regular,
    Cormorant_600SemiBold,
    Cormorant_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMMono_500Medium,
  });

  useEffect(() => {
    getDatabase()
      .then(() => materializeRecurringTransactions())
      .then(() => accountRepo.list())
      .then((accounts) => {
        setHasAccounts(accounts.length > 0);
        setDbReady(true);
      })
      .catch((e) => setDbError(String(e)));
  }, []);

  const ready = fontsLoaded && dbReady && hasAccounts !== null;

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync();
    if (!hasAccounts) {
      router.replace('/onboarding');
    }
  }, [ready]);

  if (dbError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>DB error: {dbError}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <Image
          source={require('../assets/centav0-icon-v1.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Centav0"
        />
        <ActivityIndicator color={theme.colors.accentPrimary} style={styles.spinner} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <AppThemeProvider>
          <ThemedStack />
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedStack() {
  const { colors, scheme } = useTheme();
  const navTheme = useMemo(() => {
    const base = scheme === 'light' ? DefaultTheme : DarkTheme;
    return {
      ...base,
      colors: { ...base.colors, background: colors.bgPrimary, card: colors.bgSurface, primary: colors.accentPrimary },
    };
  }, [scheme, colors]);

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      <CalculatorProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bgPrimary },
            animation: 'slide_from_right',
          }}
        />
      </CalculatorProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.bgPrimary },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bgPrimary,
  },
  logo: {
    width: 220,
    height: 220,
  },
  spinner: {
    marginTop: theme.spacing['5'],
  },
  errorText: {
    ...theme.typography.bodySm,
    color: theme.colors.negative,
  },
});
