import 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, useRouter } from 'expo-router';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
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
import { theme } from '../src/theme';

SplashScreen.preventAutoHideAsync();

// Dark nav theme so no white frame shows behind screen transitions
const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.colors.bgPrimary,
    card: theme.colors.bgSurface,
    primary: theme.colors.accentPrimary,
  },
};

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
          source={require('../assets/splash-icon.png')}
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
        <ThemeProvider value={navTheme}>
          <StatusBar style="light" backgroundColor={theme.colors.bgPrimary} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.colors.bgPrimary },
              animation: 'slide_from_right',
            }}
          />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
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
    width: 120,
    height: 180,
  },
  spinner: {
    marginTop: theme.spacing['5'],
  },
  errorText: {
    ...theme.typography.bodySm,
    color: theme.colors.negative,
  },
});
