import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../src/theme';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.logo}>Centav0</Text>
        <Text style={styles.tagline}>Your finances,{'\n'}beautifully tracked.</Text>
      </View>
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => router.push('/onboarding/setup-account')}
          accessibilityRole="button"
          accessibilityLabel="Get Started"
        >
          <Text style={styles.btnText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing['8'],
  },
  logo: {
    ...theme.typography.displayLg,
    color: theme.colors.accentPrimary,
    marginBottom: theme.spacing['5'],
  },
  tagline: {
    ...theme.typography.bodyLg,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 32,
  },
  footer: {
    paddingHorizontal: theme.spacing['6'],
    paddingBottom: theme.spacing['8'],
  },
  btn: {
    backgroundColor: theme.colors.accentPrimary,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing['5'],
    alignItems: 'center',
  },
  btnText: {
    ...theme.typography.labelLg,
    color: theme.colors.bgPrimary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
