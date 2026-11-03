import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/wayfinder/ui';
import { FontFamily, Type } from '@/constants/theme';
import { useWayfinder } from '@/hooks/use-wayfinder';

const PROVIDERS = ['Google', 'Facebook', 'X'] as const;

export function SocialRow({ heading, onPress }: { heading: string; onPress: (provider: string) => void }) {
  const { c } = useWayfinder();
  return (
    <View style={styles.social}>
      <Text style={[Type.label, { color: c.muted }]}>{heading.toUpperCase()}</Text>
      <View style={[styles.socialRow, { borderColor: c.line, backgroundColor: c.surface }]}>
        {PROVIDERS.map((provider, i) => (
          <Pressable
            key={provider}
            accessibilityRole="button"
            accessibilityLabel={`Continue with ${provider}`}
            onPress={() => onPress(provider)}
            style={({ pressed }) => [
              styles.socialBtn,
              i > 0 && { borderLeftWidth: 1, borderLeftColor: c.line },
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.socialText, { color: c.text }]}>{provider}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function FooterLink({ prompt, action, onPress, disabled }: { prompt: string; action: string; onPress: () => void; disabled?: boolean }) {
  const { c } = useWayfinder();
  return (
    <View style={styles.footer}>
      <Text style={[styles.footerText, { color: c.muted }]}>{prompt} </Text>
      <Pressable onPress={onPress} disabled={disabled} accessibilityRole="link" accessibilityLabel={action} hitSlop={10}>
        <Text style={[styles.footerLink, { color: c.accentText }]}>{action} →</Text>
      </Pressable>
    </View>
  );
}

export function ApiNotConfigured({ showBack = false }: { showBack?: boolean }) {
  const { top } = useSafeAreaInsets();
  return (
    <ThemedView style={[styles.fallback, { paddingTop: top + 24 }]}>
      <ThemedText type="title">Connect API</ThemedText>
      <ThemedText>Point the app at your FastAPI backend (Neon is used only on the server).</ThemedText>
      <ThemedText style={styles.fallbackList}>
        {`• .env: EXPO_PUBLIC_API_URL=http://127.0.0.1:8000\n• Or constants/api-config.ts API_BASE_URL_OVERRIDE\n• Or app.config.js extra.apiBaseUrl\n• Android emulator: http://10.0.2.2:8000`}
      </ThemedText>
      {showBack ? (
        <Button label="Back to Sign in" variant="secondary" onPress={() => router.replace('/sign-in' as Href)} />
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  social: { gap: 10 },
  socialRow: { flexDirection: 'row', borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  socialBtn: { flex: 1, height: 50, alignItems: 'center', justifyContent: 'center' },
  socialText: { fontFamily: FontFamily.semibold, fontSize: 15 },
  pressed: { opacity: 0.7 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 20 },
  footerText: { fontFamily: FontFamily.regular, fontSize: 15 },
  footerLink: { fontFamily: FontFamily.bold, fontSize: 15 },
  fallback: { flex: 1, gap: 12, paddingHorizontal: 24 },
  fallbackList: { fontSize: 13, lineHeight: 22 },
});
