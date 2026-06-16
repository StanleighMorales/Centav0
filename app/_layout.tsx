import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Slot, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
        <Text style={styles.logo}>Centav0</Text>
        <ActivityIndicator color={theme.colors.accentPrimary} style={styles.spinner} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <Slot />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bgPrimary,
  },
  logo: {
    ...theme.typography.displayMd,
    color: theme.colors.accentPrimary,
  },
  spinner: {
    marginTop: theme.spacing['5'],
  },
  errorText: {
    ...theme.typography.bodySm,
    color: theme.colors.negative,
  },
});
