import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { AppText } from '../ui/AppText';
import { theme, makeStyles, useTheme } from '../../theme';

type Props = {
  onResult: (text: string) => void;
  autoStart?: boolean;
  label?: string;
  /** Shown under the button before anything is heard. */
  hint?: string;
  /** Names to listen for (accounts, lenders) so "Atome" isn't heard as "atomic". Android 13+. */
  names?: string[];
};

const ERROR_TEXT: Record<string, string> = {
  'not-allowed': 'Microphone permission is off. Enable it in Settings to use voice.',
  'no-speech': "Didn't catch that. Tap and try again.",
  'speech-timeout': "Didn't catch that. Tap and try again.",
  'network': 'Voice needs a connection on this phone. Try again online.',
  'language-not-supported': 'Voice input is not available on this phone.',
  'service-not-allowed': 'Voice input is not available on this phone.',
};

export function VoiceInputButton({
  onResult,
  autoStart,
  label = 'Speak transaction',
  hint = 'Try “coffee worth 120 pesos as expense”',
  names,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Speech events are global; several sheets can be mounted at once, so only the one that started listens.
  const active = useRef(false);
  // Auto-start runs from the mount effect; read names at start time, not from that first render.
  const namesRef = useRef(names);
  namesRef.current = names;

  useSpeechRecognitionEvent('start', () => { if (active.current) setListening(true); });
  useSpeechRecognitionEvent('end', () => {
    if (!active.current) return;
    active.current = false;
    setListening(false);
  });
  useSpeechRecognitionEvent('result', (e) => {
    if (!active.current) return;
    const text = e.results[0]?.transcript ?? '';
    setHeard(text);
    if (e.isFinal && text) onResult(text);
  });
  useSpeechRecognitionEvent('error', (e) => {
    if (!active.current || e.error === 'aborted') return;
    setError(ERROR_TEXT[e.error] ?? 'Voice input failed. Try again.');
  });

  useEffect(() => () => { if (active.current) ExpoSpeechRecognitionModule.abort(); }, []);
  // Mounted fresh each time the sheet opens, so this fires once per fast-dial open.
  useEffect(() => { if (autoStart) toggle(); }, []);

  async function toggle() {
    if (listening) { ExpoSpeechRecognitionModule.stop(); return; }
    setError(null);
    setHeard('');
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) { setError(ERROR_TEXT['not-allowed']); return; }
    active.current = true;
    ExpoSpeechRecognitionModule.start({ lang: 'en-PH', interimResults: true, contextualStrings: namesRef.current });
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={listening ? 'Stop listening' : label}
        accessibilityState={{ busy: listening }}
        style={[styles.button, listening && styles.buttonActive]}
      >
        <Feather name={listening ? 'square' : 'mic'} size={18} color={colors.accentText} />
        <AppText variant="body" color="accentText">
          {listening ? 'Listening… tap to stop' : label}
        </AppText>
      </Pressable>
      {error ? (
        <AppText variant="bodySm" color="negative">{error}</AppText>
      ) : heard ? (
        <AppText variant="bodySm" color="textSecondary">“{heard}”</AppText>
      ) : (
        <AppText variant="bodySm" color="textMuted">{hint}</AppText>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: theme.spacing[2] },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    paddingVertical: theme.spacing[4],
    paddingHorizontal: theme.spacing[5],
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: c.accentBorder,
    backgroundColor: c.accentSubtle,
  },
  buttonActive: { borderColor: c.accentPrimary },
}));
