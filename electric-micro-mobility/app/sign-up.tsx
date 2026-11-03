import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { ApiNotConfigured, FooterLink, SocialRow } from '@/components/wayfinder/auth-parts';
import { RouteStop } from '@/components/wayfinder/route';
import { BackButton, Button, Field } from '@/components/wayfinder/ui';
import { FontFamily, LoaderAccent } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useWayfinder } from '@/hooks/use-wayfinder';

type FieldKey = 'name' | 'email' | 'phone' | 'password';

export default function SignUpScreen() {
  const insets = useSafeAreaInsets();
  const { c } = useWayfinder();
  const { user, loading, configured, signUp } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [focused, setFocused] = useState<FieldKey | null>(null);

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
        <ActivityIndicator size="large" color={LoaderAccent} />
      </ThemedView>
    );
  }

  if (!configured) return <ApiNotConfigured showBack />;

  const stopState = (key: FieldKey, value: string) => (focused === key || !!value ? 'current' : 'upcoming');

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: c.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.topRow}>
          <BackButton onPress={() => router.replace('/sign-in' as Href)} />
          <View style={styles.steps} accessibilityLabel="Step 1 of 2">
            <View style={[styles.stepActive, { backgroundColor: c.accent }]} />
            <View style={[styles.stepNext, { backgroundColor: c.line }]} />
          </View>
        </View>

        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
          Join the{'\n'}network<Text style={{ color: c.accent }}>.</Text>
        </Text>
        <Text style={[styles.subtitle, { color: c.muted }]}>Scooters, e-bikes and cars on one account.</Text>

        <View style={styles.form}>
          <RouteStop state={stopState('name', name)} line="accent">
            <Field
              label="Name"
              placeholder="ex: Jane Doe"
              autoComplete="name"
              value={name}
              onChangeText={(t) => {
                setName(t);
                setFormError(null);
              }}
              onFocus={() => setFocused('name')}
              onBlur={() => setFocused(null)}
              style={styles.field}
            />
          </RouteStop>
          <RouteStop state={stopState('email', email)} line="accent">
            <Field
              label="Email"
              placeholder="ex: jon.smith@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setFormError(null);
              }}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              style={styles.field}
            />
          </RouteStop>
          <RouteStop state={stopState('phone', phoneNumber)} line="accent">
            <Field
              label="Phone number"
              placeholder="ex: +1 555 123 4567"
              keyboardType="phone-pad"
              autoComplete="tel"
              value={phoneNumber}
              onChangeText={(t) => {
                setPhoneNumber(t);
                setFormError(null);
              }}
              onFocus={() => setFocused('phone')}
              onBlur={() => setFocused(null)}
              style={styles.field}
            />
          </RouteStop>
          <RouteStop state={stopState('password', password)} line="accent">
            <Field
              label="Password"
              placeholder="8+ characters"
              secureTextEntry
              autoComplete="new-password"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setFormError(null);
              }}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
              style={styles.field}
            />
          </RouteStop>
          {formError ? (
            <RouteStop state="upcoming" line="accent" dotOffset={0}>
              <Text style={[styles.error, { color: c.accentText }]}>{formError}</Text>
            </RouteStop>
          ) : null}
          <RouteStop state="end" centered>
            <Button
              label="Sign up"
              onPress={() => void onSubmit()}
              loading={busy}
              height={58}
              spread
              trailing={<Ionicons name="arrow-forward" size={22} color={c.onAccent} />}
            />
          </RouteStop>
        </View>

        <View style={styles.socialBlock}>
          <SocialRow heading="Or sign up with" onPress={onSocialPlaceholder} />
          <FooterLink
            prompt="Already riding?"
            action="Sign in"
            disabled={busy}
            onPress={() => router.replace('/sign-in' as Href)}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flexGrow: 1, paddingHorizontal: 24, width: '100%', maxWidth: 480, alignSelf: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  steps: { flexDirection: 'row', gap: 6 },
  stepActive: { width: 22, height: 6, borderRadius: 3 },
  stepNext: { width: 6, height: 6, borderRadius: 3 },
  title: { fontFamily: FontFamily.display, fontSize: 56, lineHeight: 56, letterSpacing: -2.5, marginTop: 18 },
  subtitle: { fontFamily: FontFamily.regular, fontSize: 16, marginTop: 10 },
  form: { marginTop: 6 },
  field: { paddingTop: 14, paddingBottom: 6 },
  error: { fontFamily: FontFamily.medium, fontSize: 14, paddingBottom: 12 },
  socialBlock: { marginTop: 'auto', paddingTop: 24 },
});
