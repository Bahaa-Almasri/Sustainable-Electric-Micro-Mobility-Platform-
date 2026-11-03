import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { Button, Field } from '@/components/wayfinder/ui';
import { FontFamily, LoaderAccent } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useWayfinder } from '@/hooks/use-wayfinder';

const SCOOTER = require('@/assets/vehicles/electric-scooter-elite.png');

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { c } = useWayfinder();
  const { user, loading, configured, signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);

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
        <ActivityIndicator size="large" color={LoaderAccent} />
      </ThemedView>
    );
  }

  if (!configured) return <ApiNotConfigured />;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: c.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.hero}>
          <View style={styles.brand}>
            <View style={[styles.brandDot, { backgroundColor: c.accent }]} />
            <Text style={[styles.brandText, { color: c.text }]}>EcoMobility</Text>
          </View>
          <View style={[styles.ring, { borderColor: c.line }]} />
          <View style={[styles.circle, { backgroundColor: c.photoTile }]} />
          <Image source={SCOOTER} style={styles.scooter} resizeMode="contain" accessibilityLabel="Electric scooter" />
        </View>

        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
          Welcome back
        </Text>
        <Text style={[styles.subtitle, { color: c.muted }]}>Sign in to your account</Text>

        <View style={styles.form}>
          <RouteStop state={focused === 'email' || !!email ? 'current' : 'upcoming'} line="accent">
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
          <RouteStop state={focused === 'password' || !!password ? 'current' : 'upcoming'} line="accent">
            <Field
              label="Password"
              placeholder="••••••••"
              secureTextEntry
              autoComplete="password"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setFormError(null);
              }}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
              onSubmitEditing={() => void onSignIn()}
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
              label="Login"
              onPress={() => void onSignIn()}
              loading={busy}
              height={58}
              spread
              trailing={<Ionicons name="arrow-forward" size={22} color={c.onAccent} />}
            />
          </RouteStop>
        </View>

        <View style={styles.socialBlock}>
          <SocialRow heading="Or sign in with" onPress={onSocialPlaceholder} />
          <FooterLink
            prompt="New to EcoMobility?"
            action="Sign up"
            disabled={busy}
            onPress={() => router.push('/sign-up' as Href)}
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
  hero: { height: 190 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandDot: { width: 12, height: 12, borderRadius: 6 },
  brandText: { fontFamily: FontFamily.display, fontSize: 16, letterSpacing: -0.2 },
  ring: { position: 'absolute', right: -50, top: -30, width: 236, height: 236, borderRadius: 118, borderWidth: 1 },
  circle: { position: 'absolute', right: -6, top: 14, width: 160, height: 160, borderRadius: 80 },
  scooter: { position: 'absolute', right: 0, top: -4, width: 190, height: 190 },
  title: { fontFamily: FontFamily.display, fontSize: 44, lineHeight: 48, letterSpacing: -1.8, marginTop: 8 },
  subtitle: { fontFamily: FontFamily.regular, fontSize: 17, marginTop: 6 },
  form: { marginTop: 8 },
  field: { paddingTop: 16, paddingBottom: 8 },
  error: { fontFamily: FontFamily.medium, fontSize: 14, paddingBottom: 12 },
  socialBlock: { marginTop: 'auto', paddingTop: 28 },
});
