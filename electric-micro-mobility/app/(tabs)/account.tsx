import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AccountHeader } from '@/components/account/account-header';
import { AccountSearchBar } from '@/components/account/account-search-bar';
import { accountSurfaces, ACCENT, cardShadow } from '@/components/account/account-theme';
import { PreferencePickerModal } from '@/components/account/preference-picker-modal';
import { QuickActionsRow } from '@/components/account/quick-actions';
import { RidePreviewCard } from '@/components/account/ride-preview-card';
import { SignOutConfirmModal } from '@/components/account/sign-out-confirm-modal';
import { SettingsRow } from '@/components/account/settings-row';
import { SettingsSection } from '@/components/account/settings-section';
import { StatsSummary, type StatItem } from '@/components/account/stats-summary';
import { ToggleRow } from '@/components/account/toggle-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LoaderAccent } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useAccountScreenData } from '@/hooks/use-account-screen-data';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePreferences } from '@/hooks/use-preferences';
import { matchesAccountSearch } from '@/lib/account-search';
import { LANGUAGE_LABELS, THEME_LABELS } from '@/lib/preferences/labels';
import { LANGUAGE_PICKER_OPTIONS, THEME_PICKER_OPTIONS } from '@/lib/preferences/picker-options';
import type { AppLanguage, ThemeMode } from '@/types/app-preferences';
import type { RideRow } from '@/types/entities';

type PreferencePickerKind = 'language' | 'theme' | null;

function rideDurationMinutes(r: RideRow): number | null {
  if (!r.start_time || !r.end_time) return null;
  const a = new Date(r.start_time).getTime();
  const b = new Date(r.end_time).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  return Math.max(1, Math.round((b - a) / 60000));
}

function comingSoon(title: string, message = 'This will be available in a future update.') {
  return () => Alert.alert(title, message);
}

export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const colorScheme = useColorScheme();
  const surfaces = accountSurfaces(colorScheme);
  const { text: onSurface, muted, subtle, cardBg, pageBg, divider, searchBg, destructive } = surfaces;

  const { preferences, updatePreferences } = usePreferences();
  const [searchQuery, setSearchQuery] = useState('');
  const [preferencePicker, setPreferencePicker] = useState<PreferencePickerKind>(null);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);

  const [notifications, setNotifications] = useState({
    push: true,
    rideReminders: true,
    reservationExpiry: true,
    promotions: false,
    email: true,
    sms: false,
    announcements: true,
  });

  const setNotif = useCallback(
    (key: keyof typeof notifications, value: boolean) => {
      setNotifications((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const {
    profile,
    rides,
    reservations,
    purchases,
    walletError,
    loading,
    refreshing,
    onRefresh,
  } = useAccountScreenData(user?.id);

  const displayName = profile?.name?.trim() || user?.email?.trim() || 'Rider';
  const avatarLetter = useMemo(
    () => (displayName.trim().charAt(0) || '?').toUpperCase(),
    [displayName]
  );
  const emailLine = profile?.email ?? user?.email ?? '';
  const phoneLine = profile?.phone_number ?? null;

  const statusLower = (profile?.status ?? '').toLowerCase();
  const isVerified = statusLower.includes('verified') || statusLower.includes('active');
  const verificationLabel = isVerified ? 'Verified' : profile?.status?.trim() || 'Pending';

  const profileCompletion = useMemo(() => {
    let p = 0;
    if (displayName && displayName !== 'Rider') p += 28;
    if (emailLine) p += 28;
    if (phoneLine) p += 22;
    if (isVerified) p += 22;
    return Math.min(100, p);
  }, [displayName, emailLine, phoneLine, isVerified]);

  const totalMinutes = useMemo(
    () => rides.reduce((s, r) => s + (rideDurationMinutes(r) ?? 0), 0),
    [rides]
  );
  const totalDistanceM = useMemo(
    () => rides.reduce((s, r) => s + (r.distance_meters ?? 0), 0),
    [rides]
  );

  const walletCredits = useMemo(
    () => purchases.reduce((s, p) => s + (p.rides_remaining ?? 0), 0),
    [purchases]
  );

  const activeReservations = useMemo(
    () => reservations.filter((r) => (r.status ?? '').toLowerCase() === 'active').length,
    [reservations]
  );

  const distanceLabel = useMemo(() => {
    const km = totalDistanceM / 1000;
    if (km < 0.1 && totalDistanceM > 0) return `${Math.round(totalDistanceM)} m`;
    return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
  }, [totalDistanceM]);

  const co2Kg = useMemo(() => {
    const km = totalDistanceM / 1000;
    return km * 0.12;
  }, [totalDistanceM]);

  const memberSinceLabel = useMemo(() => {
    const times = rides.map((r) => r.start_time).filter(Boolean) as string[];
    if (!times.length) return 'Welcome — start your first ride';
    times.sort();
    const d = new Date(times[0]!);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }, [rides]);

  const walletLine = walletError ? 'Tap to refresh in Wallet' : `${walletCredits} ride credits`;

  const favoriteVehicleLine =
    rides.length > 0 ? 'E-scooter' : '—';

  const statsItems = useMemo((): StatItem[] => {
    const base: StatItem[] = [
      {
        key: 'rides',
        label: 'Total rides',
        value: `${rides.length}`,
        icon: 'navigate-outline',
      },
      {
        key: 'mins',
        label: 'Total time',
        value: `${totalMinutes}`,
        sub: 'minutes',
        icon: 'time-outline',
        highlight: totalMinutes > 0,
      },
      {
        key: 'dist',
        label: 'Distance',
        value: rides.length ? distanceLabel : '—',
        sub: totalDistanceM ? undefined : 'No trips yet',
        icon: 'speedometer-outline',
      },
      {
        key: 'fav',
        label: 'Favorite type',
        value: favoriteVehicleLine,
        sub: rides.length ? 'Typical choice' : undefined,
        icon: 'bicycle-outline',
      },
      {
        key: 'wallet',
        label: 'Wallet',
        value: walletError ? '—' : `${walletCredits}`,
        sub: walletError ?? 'ride credits',
        icon: 'wallet-outline',
      },
      {
        key: 'resv',
        label: 'Active holds',
        value: `${activeReservations}`,
        sub: activeReservations ? 'Tap Reservations tab' : 'None',
        icon: 'calendar-outline',
      },
    ];
    if (totalDistanceM > 0) {
      base.push({
        key: 'co2',
        label: 'Est. impact vs. car',
        value: `~${co2Kg < 10 ? co2Kg.toFixed(1) : Math.round(co2Kg)} kg`,
        sub: 'CO₂ not emitted (estimate)',
        icon: 'leaf-outline',
        fullWidth: true,
      });
    }
    return base;
  }, [
    rides.length,
    totalMinutes,
    distanceLabel,
    favoriteVehicleLine,
    walletCredits,
    walletError,
    activeReservations,
    totalDistanceM,
    co2Kg,
  ]);

  const rowColors = useMemo(
    () => ({ text: onSurface, muted, divider, cardBg }),
    [onSurface, muted, divider, cardBg]
  );

  const qProfile = ['profile', 'account', 'email', 'phone', 'password', 'security', 'verified', displayName, emailLine];
  const qQuick = ['quick', 'action', 'edit', 'payment', 'notifications', 'help', 'wallet'];
  const qStats = ['usage', 'rides', 'minutes', 'wallet', 'distance', 'reservation', 'impact', 'environment'];
  const qPrefs = ['preference', 'language', 'theme', 'accessibility', 'sound', 'vibration'];
  const qNotif = ['notification', 'push', 'reminder', 'expiry', 'promotion', 'email', 'sms', 'announcement'];
  const qPay = ['payment', 'wallet', 'card', 'billing', 'transaction', 'promo', 'credit'];
  const qSafety = ['safety', 'emergency', 'report', 'history', 'license', 'ride'];
  const qApp = ['privacy', 'terms', 'help', 'faq', 'support', 'about', 'version', 'logout', 'delete'];

  const showProfile = matchesAccountSearch(searchQuery, qProfile);
  const showQuick = matchesAccountSearch(searchQuery, qQuick);
  const showStats = matchesAccountSearch(searchQuery, qStats);
  const showPrefs = matchesAccountSearch(searchQuery, qPrefs);
  const showNotif = matchesAccountSearch(searchQuery, qNotif);
  const showPay = matchesAccountSearch(searchQuery, qPay);
  const showSafety = matchesAccountSearch(searchQuery, qSafety);
  const showApp = matchesAccountSearch(searchQuery, qApp);
  const showRecent = matchesAccountSearch(searchQuery, ['recent', 'activity', 'ride', 'history']);

  const noSearchHits =
    searchQuery.trim().length > 0 &&
    !showProfile &&
    !showQuick &&
    !showStats &&
    !showPrefs &&
    !showNotif &&
    !showPay &&
    !showSafety &&
    !showApp;

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const onSignOut = useCallback(async () => {
    setSignOutBusy(true);
    try {
      await signOut();
      router.replace('/sign-in' as Href);
    } catch (e) {
      setSignOutBusy(false);
      Alert.alert(
        'Sign out failed',
        e instanceof Error ? e.message : 'Could not end your session. Please try again.'
      );
    }
  }, [signOut]);

  const activePreferencePicker = useMemo(() => {
    if (!preferencePicker) return null;
    const p = preferences;
    switch (preferencePicker) {
      case 'language':
        return {
          title: 'Language',
          options: LANGUAGE_PICKER_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
          selectedValue: p.language,
          apply: (v: string) => updatePreferences({ language: v as AppLanguage }),
        };
      case 'theme':
        return {
          title: 'Theme',
          options: THEME_PICKER_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
          selectedValue: p.themeMode,
          apply: (v: string) => updatePreferences({ themeMode: v as ThemeMode }),
        };
      default:
        return null;
    }
  }, [preferencePicker, preferences, updatePreferences]);

  const confirmDelete = useCallback(() => {
    Alert.alert(
      'Delete account',
      'This is irreversible. In production this would remove your profile and request data deletion per policy.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: comingSoon('Request received', 'Account deletion flow TBD.') },
      ]
    );
  }, []);

  if (loading && !refreshing) {
    return (
      <ThemedView
        style={[styles.centered, styles.loadingScreen]}
        lightColor={pageBg}
        darkColor={pageBg}>
        <ActivityIndicator size="large" color={LoaderAccent} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.flex} lightColor={pageBg} darkColor={pageBg}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LoaderAccent} />
        }>
        <AccountHeader
          displayName={displayName}
          email={emailLine}
          phone={phoneLine}
          memberSinceLabel={memberSinceLabel}
          avatarLetter={avatarLetter}
          verificationLabel={verificationLabel}
          isVerified={isVerified}
          profileCompletion={profileCompletion}
          pageBg={pageBg}
          onEditProfile={comingSoon('Edit profile', 'Updates will sync from your profile API.')}
          onChangePhoto={comingSoon('Profile photo', 'Camera & library upload will connect here.')}
          onSecurity={comingSoon('Login & security', 'Sessions, devices, and MFA will be managed here.')}
          colors={{
            text: onSurface,
            muted,
            subtle,
            cardBg,
            elevatedStroke: surfaces.elevatedStroke,
          }}
        />

        {showQuick ? (
          <QuickActionsRow
            actions={[
              {
                key: 'edit',
                label: 'Edit profile',
                icon: 'person-outline',
                onPress: comingSoon('Edit profile'),
              },
              {
                key: 'pay',
                label: 'Payments',
                icon: 'card-outline',
                onPress: () => router.push('/(tabs)/wallet' as Href),
              },
              {
                key: 'bell',
                label: 'Alerts',
                icon: 'notifications-outline',
                onPress: () => {
                  setSearchQuery('notification');
                },
              },
              {
                key: 'help',
                label: 'Help',
                icon: 'help-circle-outline',
                onPress: () => router.push('/(tabs)/support' as Href),
              },
            ]}
            colors={{
              text: onSurface,
              muted,
              cardBg,
              elevatedStroke: surfaces.elevatedStroke,
            }}
          />
        ) : null}

        <AccountSearchBar value={searchQuery} onChangeText={setSearchQuery} colors={{ text: onSurface, muted, searchBg }} />

        {noSearchHits ? (
          <View style={[styles.noResults, cardShadow, { backgroundColor: cardBg }]}>
            <Ionicons name="search-outline" size={22} color={muted} />
            <ThemedText style={styles.noResultsText} lightColor={muted} darkColor={muted}>
              No settings match “{searchQuery.trim()}”. Try another keyword.
            </ThemedText>
          </View>
        ) : null}

        {showStats ? (
          <SettingsSection title="USAGE & IMPACT" titleColor={muted} surfaceColor={cardBg} visible>
            <StatsSummary items={statsItems} colors={{ text: onSurface, muted, cardBg }} />
          </SettingsSection>
        ) : null}

        <SettingsSection
          title="PROFILE & ACCOUNT"
          titleColor={muted}
          surfaceColor={cardBg}
          visible={showProfile}>
          <SettingsRow
            title="Change password"
            subtitle="Update your sign-in password"
            icon="key-outline"
            colors={rowColors}
            onPress={comingSoon('Change password')}
            isFirst
          />
          <SettingsRow
            title="Login & security"
            subtitle="Sessions, 2FA, and linked devices"
            icon="shield-checkmark-outline"
            colors={rowColors}
            onPress={comingSoon('Login & security')}
          />
          <SettingsRow
            title="Verify identity"
            subtitle="Driver license or ID for regulated zones"
            icon="person-circle-outline"
            colors={rowColors}
            onPress={comingSoon('Identity verification')}
            badge="Recommended"
            badgeVariant="recommended"
            isLast
          />
        </SettingsSection>

        <SettingsSection title="PREFERENCES" titleColor={muted} surfaceColor={cardBg} visible={showPrefs}>
          <SettingsRow
            title="Language"
            subtitle={LANGUAGE_LABELS[preferences.language]}
            icon="language-outline"
            colors={rowColors}
            onPress={() => setPreferencePicker('language')}
            isFirst
          />
          <SettingsRow
            title="Theme"
            subtitle={THEME_LABELS[preferences.themeMode]}
            icon="moon-outline"
            colors={rowColors}
            onPress={() => setPreferencePicker('theme')}
          />
          <ToggleRow
            title="Accessibility"
            subtitle="Larger touch targets & contrast"
            icon="accessibility-outline"
            value={preferences.accessibilityEnabled}
            onValueChange={(v) => updatePreferences({ accessibilityEnabled: v })}
            colors={rowColors}
          />
          <ToggleRow
            title="Sounds"
            subtitle="Arrival, start, and end chimes"
            icon="volume-high-outline"
            value={preferences.soundsEnabled}
            onValueChange={(v) => updatePreferences({ soundsEnabled: v })}
            colors={rowColors}
          />
          <ToggleRow
            title="Vibration"
            subtitle="Haptics for actions"
            icon="phone-portrait-outline"
            value={preferences.vibrationEnabled}
            onValueChange={(v) => updatePreferences({ vibrationEnabled: v })}
            colors={rowColors}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="NOTIFICATIONS" titleColor={muted} surfaceColor={cardBg} visible={showNotif}>
          <ToggleRow
            title="Push notifications"
            subtitle="Critical trip and fleet alerts"
            icon="notifications-outline"
            value={notifications.push}
            onValueChange={(v) => setNotif('push', v)}
            colors={rowColors}
          />
          <ToggleRow
            title="Ride reminders"
            subtitle="Start and end nudges"
            icon="alarm-outline"
            value={notifications.rideReminders}
            onValueChange={(v) => setNotif('rideReminders', v)}
            colors={rowColors}
          />
          <ToggleRow
            title="Reservation expiry"
            subtitle="Before your hold ends"
            icon="hourglass-outline"
            value={notifications.reservationExpiry}
            onValueChange={(v) => setNotif('reservationExpiry', v)}
            colors={rowColors}
          />
          <ToggleRow
            title="Promotions & offers"
            subtitle="Credits and partner deals (new)"
            icon="pricetag-outline"
            value={notifications.promotions}
            onValueChange={(v) => setNotif('promotions', v)}
            colors={rowColors}
          />
          <ToggleRow
            title="Email"
            subtitle="Receipts and statements"
            icon="mail-outline"
            value={notifications.email}
            onValueChange={(v) => setNotif('email', v)}
            colors={rowColors}
          />
          <ToggleRow
            title="SMS"
            subtitle="Security codes and ride status"
            icon="chatbubble-outline"
            value={notifications.sms}
            onValueChange={(v) => setNotif('sms', v)}
            colors={rowColors}
          />
          <ToggleRow
            title="System announcements"
            subtitle="Incidents, policy, and app updates"
            icon="megaphone-outline"
            value={notifications.announcements}
            onValueChange={(v) => setNotif('announcements', v)}
            colors={rowColors}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="PAYMENT & WALLET" titleColor={muted} surfaceColor={cardBg} visible={showPay}>
          <SettingsRow
            title="Wallet & credits"
            subtitle={walletLine}
            icon="wallet-outline"
            colors={rowColors}
            onPress={() => router.push('/(tabs)/wallet' as Href)}
            isFirst
          />
          <SettingsRow
            title="Saved payment methods"
            subtitle="Cards and digital wallets"
            icon="card-outline"
            colors={rowColors}
            onPress={() => router.push('/(tabs)/wallet' as Href)}
          />
          <SettingsRow
            title="Billing history"
            subtitle="Invoices and receipts"
            icon="document-text-outline"
            colors={rowColors}
            onPress={comingSoon('Billing history')}
          />
          <SettingsRow
            title="Transactions"
            subtitle="Top-ups and trip charges"
            icon="swap-horizontal-outline"
            colors={rowColors}
            onPress={comingSoon('Transactions')}
          />
          <SettingsRow
            title="Promo codes"
            subtitle="Apply discounts and campaigns"
            icon="gift-outline"
            colors={rowColors}
            onPress={comingSoon('Promo codes')}
            badge="New"
            badgeVariant="new"
            isLast
          />
        </SettingsSection>

        <SettingsSection title="RIDE & SAFETY" titleColor={muted} surfaceColor={cardBg} visible={showSafety}>
          <SettingsRow
            title="Emergency contact"
            subtitle="Shared with trip monitoring"
            icon="medkit-outline"
            colors={rowColors}
            onPress={comingSoon('Emergency contact')}
            isFirst
          />
          <SettingsRow title="Safety tips" subtitle="Helmet, lanes, and night riding" icon="bulb-outline" colors={rowColors} onPress={comingSoon('Safety tips')} />
          <SettingsRow
            title="Report an issue"
            subtitle="Damage, harassment, or blocked paths"
            icon="warning-outline"
            colors={rowColors}
            onPress={() => router.push('/(tabs)/support' as Href)}
          />
          <SettingsRow
            title="Ride history"
            subtitle={`${rides.length} completed trips`}
            icon="git-commit-outline"
            colors={rowColors}
            onPress={comingSoon('Ride history', 'Export and filters will live here.')}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="APP" titleColor={muted} surfaceColor={cardBg} visible={showApp}>
          <SettingsRow
            title="Privacy"
            subtitle="Data, analytics, and sharing"
            icon="lock-closed-outline"
            colors={rowColors}
            onPress={comingSoon('Privacy')}
            isFirst
          />
          <SettingsRow title="Terms & conditions" subtitle="Use of service" icon="document-outline" colors={rowColors} onPress={comingSoon('Terms')} />
          <SettingsRow title="Help center" subtitle="Guides and troubleshooting" icon="book-outline" colors={rowColors} onPress={() => router.push('/(tabs)/support' as Href)} />
          <SettingsRow title="FAQ" subtitle="Short answers to common questions" icon="help-circle-outline" colors={rowColors} onPress={comingSoon('FAQ')} />
          <SettingsRow
            title="Contact support"
            subtitle="Chat and ticket history"
            icon="chatbubbles-outline"
            colors={rowColors}
            onPress={() => router.push('/(tabs)/support' as Href)}
          />
          <SettingsRow
            title="About"
            subtitle={`EcoMobility • v${appVersion}`}
            icon="information-circle-outline"
            colors={rowColors}
            onPress={comingSoon('About EcoMobility')}
            isLast
          />
        </SettingsSection>

        {showRecent && rides.length > 0 ? (
          <View style={styles.recentBlock}>
            <View style={styles.recentHead}>
              <Text style={[styles.recentTitle, { color: muted }]}>RECENT ACTIVITY</Text>
              <Pressable onPress={comingSoon('Ride history')} hitSlop={8}>
                <Text style={[styles.recentLink, { color: ACCENT }]}>See all</Text>
              </Pressable>
            </View>
            {rides.slice(0, 3).map((r) => (
              <RidePreviewCard key={r.ride_id} item={r} />
            ))}
          </View>
        ) : null}

        <View style={styles.footerSpacer} />

        <Pressable
          onPress={() => setSignOutConfirmOpen(true)}
          style={({ pressed }) => [
            styles.signOut,
            { borderColor: `${destructive}66` },
            pressed && { opacity: 0.88 },
          ]}>
          <Ionicons name="log-out-outline" size={20} color={destructive} />
          <Text style={[styles.signOutLabel, { color: destructive }]}>Log out</Text>
        </Pressable>

        <Pressable
          onPress={confirmDelete}
          style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.9 }]}>
          <Text style={[styles.deleteLabel, { color: muted }]}>Delete account</Text>
        </Pressable>

        <ThemedText style={[styles.note, { opacity: 0.7 }]} lightColor={muted} darkColor={muted}>
          Account preferences are saved on this device (AsyncStorage). Other settings can sync with your backend
          later.
        </ThemedText>
      </ScrollView>

      {activePreferencePicker ? (
        <PreferencePickerModal
          visible={preferencePicker != null}
          title={activePreferencePicker.title}
          options={activePreferencePicker.options}
          selectedValue={activePreferencePicker.selectedValue}
          onSelect={(v) => activePreferencePicker.apply(v)}
          onClose={() => setPreferencePicker(null)}
          colors={{
            text: onSurface,
            muted,
            cardBg,
            divider,
          }}
        />
      ) : null}

      <SignOutConfirmModal
        visible={signOutConfirmOpen}
        busy={signOutBusy}
        onClose={() => {
          if (!signOutBusy) setSignOutConfirmOpen(false);
        }}
        onConfirm={() => void onSignOut()}
        colors={{
          text: onSurface,
          muted,
          cardBg,
          divider,
          destructive,
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingScreen: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  recentBlock: {
    marginBottom: 8,
  },
  recentHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  recentTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  recentLink: {
    fontSize: 13,
    fontWeight: '800',
  },
  footerSpacer: {
    height: 8,
  },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth * 2,
    marginBottom: 14,
  },
  signOutLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  deleteBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 12,
  },
  deleteLabel: {
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  note: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  noResults: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    marginBottom: 18,
  },
  noResultsText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
});
