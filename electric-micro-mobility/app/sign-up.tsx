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
const LINK_RED = '#E53935';
const GRADIENT_GREEN = '#1B4332';
const GRADIENT_RED = '#D90429';

export default function SignUpScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, loading, configured, signUp } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && configured) {
      router.replace('/(tabs)/wallet' as Href);
    }
  }, [user, loading, configured]);

  async function onSubmit() {
    setFormError(null);
    const n = name.trim();
    const e = email.trim();
    if (!n) {
      const msg = 'Enter your name.';
      setFormError(msg);
      Alert.alert('Missing name', msg);
      return;
    }
    if (!e) {
      const msg = 'Enter your email.';
      setFormError(msg);
      Alert.alert('Missing email', msg);
      return;
    }
    const ph = phoneNumber.replace(/\s/g, '').trim();
    if (!ph || ph.length < 7) {
      const msg = 'Enter a valid phone number (at least 7 digits).';
      setFormError(msg);
      Alert.alert('Missing phone', msg);
      return;
    }
    if (!password) {
      const msg = 'Enter a password.';
      setFormError(msg);
      Alert.alert('Missing password', msg);
      return;
    }
    if (password.length < 8) {
      const msg = 'Use at least 8 characters for your password.';
      setFormError(msg);
      Alert.alert('Weak password', msg);
      return;
    }
    setBusy(true);
    try {
      const { error } = await signUp({
        name: n,
        email: e,
        phone_number: ph,
        password,
      });
      if (error) {
        setFormError(error.message);
        Alert.alert('Sign up failed', error.message);
        return;
      }
      router.replace('/(tabs)/wallet' as Href);
    } finally {
      setBusy(false);
    }
  }

  function onSocialPlaceholder(provider: string) {
    Alert.alert('Coming soon', `${provider} sign-up is not connected yet.`);
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
      <ThemedView style={[styles.fallback, { paddingTop: insets.top + 24, paddingHorizontal: 24 }]}>
        <ThemedText type="title" style={styles.fallbackTitle}>
          Connect API
        </ThemedText>
        <ThemedText style={styles.body}>
          Point the app at your FastAPI backend (Neon is used only on the server).
        </ThemedText>
        <ThemedText style={styles.list}>
          {`• .env: EXPO_PUBLIC_API_URL=http://127.0.0.1:8000\n• Or constants/api-config.ts API_BASE_URL_OVERRIDE\n• Or app.config.js extra.apiBaseUrl\n• Android emulator: http://10.0.2.2:8000`}
        </ThemedText>
        <TouchableOpacity onPress={() => router.replace('/sign-in' as Href)} style={styles.fallbackLinkWrap} accessibilityRole="button">
          <Text style={styles.fallbackLink}>Back to Sign in</Text>
        </TouchableOpacity>
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
          <TouchableOpacity
            onPress={() => router.replace('/sign-in' as Href)}
            style={styles.backLink}
            disabled={busy}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Back to sign in">
            <Ionicons name="chevron-back" size={20} color={LINK_RED} />
            <Text style={styles.backLinkText}>Sign in</Text>
          </TouchableOpacity>

          <View style={styles.logoBlock}>
            <View style={styles.logoMark}>
              <Ionicons name="location" size={52} color="#C62828" style={styles.logoPin} />
              <View style={styles.logoBadge}>
                <MaterialCommunityIcons name="scooter-electric" size={18} color="#2E7D32" />
              </View>
            </View>
          </View>

          <Text style={styles.heading}>Create your account</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="ex: Jane Doe"
              placeholderTextColor="#BDBDBD"
              autoComplete="name"
              value={name}
              onChangeText={(t) => {
                setName(t);
                setFormError(null);
              }}
              accessibilityLabel="Name"
            />
          </View>

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
            <Text style={styles.fieldLabel}>Phone number</Text>
            <TextInput
              style={styles.input}
              placeholder="ex: +1 555 123 4567"
              placeholderTextColor="#BDBDBD"
              keyboardType="phone-pad"
              autoComplete="tel"
              value={phoneNumber}
              onChangeText={(t) => {
                setPhoneNumber(t);
                setFormError(null);
              }}
              accessibilityLabel="Phone number"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••         "
              placeholderTextColor="#BDBDBD"
              secureTextEntry
              autoComplete="new-password"
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
            onPress={onSubmit}
            disabled={busy}
            style={({ pressed }) => [styles.submitPressable, pressed && !busy && styles.submitPressablePressed]}>
            <LinearGradient
              colors={[GRADIENT_GREEN, GRADIENT_RED]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.submitGradient}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Sign up</Text>
              )}
            </LinearGradient>
          </Pressable>

          <Text style={styles.socialDivider}>or sign up with</Text>

          <View style={styles.socialRow}>
            <Pressable
              style={({ pressed }) => [styles.socialBtn, pressed && styles.socialBtnPressed]}
              onPress={() => onSocialPlaceholder('Google')}
              accessibilityRole="button"
              accessibilityLabel="Sign up with Google">
              <Ionicons name="logo-google" size={22} color="#DB4437" />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.socialBtn, pressed && styles.socialBtnPressed]}
              onPress={() => onSocialPlaceholder('Facebook')}
              accessibilityRole="button"
              accessibilityLabel="Sign up with Facebook">
              <Ionicons name="logo-facebook" size={22} color="#4267B2" />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.socialBtn, pressed && styles.socialBtnPressed]}
              onPress={() => onSocialPlaceholder('Twitter')}
              accessibilityRole="button"
              accessibilityLabel="Sign up with X / Twitter">
              <Ionicons name="logo-twitter" size={22} color="#1DA1F2" />
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerMuted}>{`Already have an account? `}</Text>
            <TouchableOpacity
              onPress={() => router.replace('/sign-in' as Href)}
              disabled={busy}
              activeOpacity={0.7}
              accessibilityRole="link"
              accessibilityLabel="Sign in">
              <Text style={styles.footerLink}>SIGN IN</Text>
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
  fallback: {
    flex: 1,
    gap: 12,
  },
  fallbackTitle: {
    marginBottom: 4,
  },
  fallbackLinkWrap: {
    marginTop: 8,
  },
  fallbackLink: {
    color: LINK_RED,
    fontWeight: '600',
    fontSize: 16,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
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
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 8,
    paddingVertical: 6,
    gap: 2,
  },
  backLinkText: {
    fontSize: 15,
    fontWeight: '600',
    color: LINK_RED,
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
  submitPressable: {
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 6,
  },
  submitPressablePressed: {
    opacity: 0.92,
  },
  submitGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    minHeight: 48,
  },
  submitButtonText: {
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
    color: LINK_RED,
    letterSpacing: 0.3,
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
