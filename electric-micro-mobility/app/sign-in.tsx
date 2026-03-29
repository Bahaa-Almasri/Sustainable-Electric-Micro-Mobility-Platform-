import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

const PAGE_BG = '#FFFFFF';
const CARD_BG = '#FFFFFF';
const INPUT_BG = '#F5F5F5';
const LABEL_COLOR = '#9E9E9E';
const HEADING_COLOR = '#111111';
const MUTED_TEXT = '#757575';
const SIGN_UP_RED = '#E53935';
const GRADIENT_GREEN = '#1B4332';
const GRADIENT_RED = '#D90429';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, loading, configured, signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && configured) {
      router.replace('/(tabs)/wallet' as Href);
    }
  }, [user, loading, configured]);

  async function onSignIn() {
    setFormError(null);
    if (!email.trim() || !password) {
      const msg = 'Enter email and password.';
      setFormError(msg);
      Alert.alert('Missing fields', msg);
      return;
    }
    setBusy(true);
    try {
      const { error } = await signIn(email.trim(), password);
      if (error) {
        setFormError(error.message);
        Alert.alert('Sign in failed', error.message);
        return;
      }
      router.replace('/(tabs)/wallet' as Href);
    } finally {
      setBusy(false);
    }
  }

  function onSocialPlaceholder(provider: string) {
    Alert.alert('Coming soon', `${provider} sign-in is not connected yet.`);
  }

  if (loading) {
    return (
      <ThemedView style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  if (!configured) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top + 24, paddingHorizontal: 24 }]}>
        <ThemedText type="title" style={styles.title}>
          Connect API
        </ThemedText>
        <ThemedText style={styles.body}>
          Point the app at your FastAPI backend (Neon is used only on the server).
        </ThemedText>
        <ThemedText style={styles.list}>
          {`• .env: EXPO_PUBLIC_API_URL=http://127.0.0.1:8000\n• Or constants/api-config.ts API_BASE_URL_OVERRIDE\n• Or app.config.js extra.apiBaseUrl\n• Android emulator: http://10.0.2.2:8000`}
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardRoot}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 20,
          },
        ]}
        keyboardDismissMode="on-drag">
        <View style={styles.card}>
          <View style={styles.logoBlock}>
            <View style={styles.logoMark}>
              <Ionicons name="location" size={52} color="#C62828" style={styles.logoPin} />
              <View style={styles.logoBadge}>
                <MaterialCommunityIcons name="scooter-electric" size={18} color="#2E7D32" />
              </View>
            </View>
          </View>

          <Text style={styles.heading}>Sign in your account</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="ex: jon.smith@email.com"
              placeholderTextColor="#BDBDBD"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setFormError(null);
              }}
              accessibilityLabel="Email"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••         "
              placeholderTextColor="#BDBDBD"
              secureTextEntry
              autoComplete="password"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setFormError(null);
              }}
              accessibilityLabel="Password"
            />
          </View>

          {formError ? <Text style={styles.formErrorText}>{formError}</Text> : null}

          <Pressable
            onPress={onSignIn}
            disabled={busy}
            style={({ pressed }) => [styles.loginPressable, pressed && !busy && styles.loginPressablePressed]}>
            <LinearGradient
              colors={[GRADIENT_GREEN, GRADIENT_RED]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.loginGradient}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>Login</Text>
              )}
            </LinearGradient>
          </Pressable>

          <Text style={styles.socialDivider}>or sign in with</Text>

          <View style={styles.socialRow}>
            <Pressable
              style={({ pressed }) => [styles.socialBtn, pressed && styles.socialBtnPressed]}
              onPress={() => onSocialPlaceholder('Google')}
              accessibilityRole="button"
              accessibilityLabel="Sign in with Google">
              <Ionicons name="logo-google" size={22} color="#DB4437" />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.socialBtn, pressed && styles.socialBtnPressed]}
              onPress={() => onSocialPlaceholder('Facebook')}
              accessibilityRole="button"
              accessibilityLabel="Sign in with Facebook">
              <Ionicons name="logo-facebook" size={22} color="#4267B2" />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.socialBtn, pressed && styles.socialBtnPressed]}
              onPress={() => onSocialPlaceholder('Twitter')}
              accessibilityRole="button"
              accessibilityLabel="Sign in with X / Twitter">
              <Ionicons name="logo-twitter" size={22} color="#1DA1F2" />
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerMuted}>{`Don't have an account? `}</Text>
            <TouchableOpacity
              onPress={() => router.push('/sign-up' as Href)}
              disabled={busy}
              activeOpacity={0.7}
              accessibilityRole="link"
              accessibilityLabel="Sign up">
              <Text style={styles.footerLink}>SIGN UP</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  scroll: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  container: {
    gap: 12,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 26,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  logoBlock: {
    alignItems: 'center',
    marginBottom: 6,
  },
  logoMark: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPin: {
    marginTop: -6,
  },
  logoBadge: {
    position: 'absolute',
    top: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: HEADING_COLOR,
    textAlign: 'center',
    marginBottom: 22,
    letterSpacing: -0.2,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    color: LABEL_COLOR,
    marginBottom: 8,
    marginLeft: 2,
    fontWeight: '500',
  },
  input: {
    backgroundColor: INPUT_BG,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: Platform.OS === 'ios' ? 15 : 12,
    fontSize: 15,
    color: '#212121',
    borderWidth: 0,
  },
  formErrorText: {
    fontSize: 13,
    color: '#B00020',
    marginBottom: 8,
    marginTop: -4,
    marginLeft: 4,
  },
  loginPressable: {
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 6,
  },
  loginPressablePressed: {
    opacity: 0.92,
  },
  loginGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    minHeight: 48,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  socialDivider: {
    textAlign: 'center',
    fontSize: 13,
    color: MUTED_TEXT,
    marginTop: 22,
    marginBottom: 14,
    fontWeight: '400',
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  socialBtn: {
    flex: 1,
    backgroundColor: INPUT_BG,
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialBtnPressed: {
    opacity: 0.85,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 26,
    paddingHorizontal: 4,
  },
  footerMuted: {
    fontSize: 14,
    color: MUTED_TEXT,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
    color: SIGN_UP_RED,
    letterSpacing: 0.3,
  },
  title: {
    marginBottom: 4,
  },
  body: {
    lineHeight: 22,
  },
  list: {
    lineHeight: 22,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 13,
  },
});
