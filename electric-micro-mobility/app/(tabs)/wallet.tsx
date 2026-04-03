import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { fetchRidePackages, fetchWalletOverview, purchaseRidePackage } from '@/lib/mobility-api';
import type { PackageRow, PaymentMethodRow, PaymentRow, PurchaseRow } from '@/types/entities';

type MethodRow = PaymentMethodRow;

const GRADIENT_GREEN = '#1B4332';
const GRADIENT_RED = '#D90429';
const RED_ACCENT = '#FF4B41';
const DEFAULT_BADGE_BG = '#B85C38';
/** Light page background — matches reference off-white */
const PAGE_BG_LIGHT = '#F2F2F4';

function formatPackagePrice(pkg: PackageRow): string {
  const cur = pkg.currency ?? 'USD';
  const p = pkg.price ?? 0;
  if (cur === 'USD' || cur === '$') return `$${Number(p).toFixed(2)}`;
  return `${cur} ${p}`;
}

export default function WalletScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const pageBg = colorScheme === 'dark' ? colors.background : PAGE_BG_LIGHT;
  const cardSurface = colorScheme === 'dark' ? '#2C2C2E' : '#FFFFFF';
  const { user } = useAuth();

  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [methods, setMethods] = useState<MethodRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const screenFocusRef = useRef(false);

  const totalRidesRemaining = useMemo(
    () => purchases.reduce((s, p) => s + (p.rides_remaining ?? 0), 0),
    [purchases]
  );

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      const [pkgRes, overview] = await Promise.all([fetchRidePackages(), fetchWalletOverview()]);

      if (!pkgRes.error && pkgRes.data) setPackages(pkgRes.data);
      else setPackages([]);

      if (!overview.error) {
        setPurchases(overview.purchases as PurchaseRow[]);
        setMethods(overview.payment_methods);
        setPayments(overview.recent_payments);
      } else {
        setPurchases([]);
        setMethods([]);
        setPayments([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      const silent = screenFocusRef.current;
      screenFocusRef.current = true;
      void load({ silent });
    }, [load])
  );

  async function onBuy(pkg: PackageRow) {
    if (!user) return;
    Alert.alert(
      'Purchase package',
      `Buy "${pkg.title ?? 'Package'}" for ${pkg.currency ?? 'USD'} ${pkg.price ?? 0}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay',
          onPress: async () => {
            setBuyingId(pkg.package_id);
            const { error } = await purchaseRidePackage(user.id, pkg);
            setBuyingId(null);
            if (error) {
              Alert.alert('Purchase failed', error);
              return;
            }
            Alert.alert('Success', 'Package added to your account.');
            void load({ silent: true });
          },
        },
      ]
    );
  }

  if (loading && !refreshing) {
    return (
      <ThemedView style={[styles.centered, { backgroundColor: pageBg }]}>
        <ActivityIndicator size="large" color={RED_ACCENT} />
      </ThemedView>
    );
  }

  return (
    <FlatList
      data={[{ key: 'content' }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      keyExtractor={(i) => i.key}
      style={{ backgroundColor: pageBg }}
      showsVerticalScrollIndicator={false}
      renderItem={() => (
        <View style={[styles.section, { backgroundColor: pageBg }]}>
          <LinearGradient
            colors={[GRADIENT_RED, GRADIENT_GREEN]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>AVAILABLE RIDES</Text>
            <View style={styles.balanceValueRow}>
              <Text style={styles.balanceValue}>{totalRidesRemaining}</Text>
              <Text style={styles.balanceUnit}>RIDES</Text>
            </View>
          </LinearGradient>

          <ThemedText type="subtitle" style={[styles.sectionHeading, styles.sectionBelowBalance]}>
            Your packages
          </ThemedText>
          {purchases.length === 0 ? (
            <ThemedText style={styles.empty}>No purchases yet.</ThemedText>
          ) : (
            purchases.map((p) => (
              <View key={p.purchase_id} style={[styles.card, { backgroundColor: cardSurface }]}>
                <ThemedText type="defaultSemiBold" style={styles.packageTitleUpper}>
                  {(p.ride_packages?.title ?? 'Package').toUpperCase()}
                </ThemedText>
                <ThemedText style={styles.subscribedSubtitle}>
                  {p.rides_remaining ?? 0} rides remaining
                </ThemedText>
              </View>
            ))
          )}

          <Pressable
            style={({ pressed }) => [styles.historyRow, pressed && styles.historyRowPressed]}
            onPress={() => router.push('/(tabs)/account' as Href)}
            accessibilityRole="button"
            accessibilityLabel="View ride history">
            <View style={styles.historyIconCircle}>
              <Ionicons name="time-outline" size={22} color="#757575" />
            </View>
            <ThemedText type="defaultSemiBold" style={styles.historyText}>
              VIEW RIDE HISTORY
            </ThemedText>
            <Ionicons name="chevron-forward" size={22} color="#BDBDBD" />
          </Pressable>

          <ThemedText type="subtitle" style={[styles.sectionHeading, styles.sectionSpacer]}>
            Ride packages
          </ThemedText>
          <ThemedText style={styles.introMuted}>
            Catalog comes from the `ride_packages` table (Neon), served by the API.
          </ThemedText>
          {packages.length === 0 ? (
            <ThemedText style={styles.empty}>No packages available yet.</ThemedText>
          ) : (
            packages.map((pkg) => (
              <View key={pkg.package_id} style={[styles.card, { backgroundColor: cardSurface }]}>
                <View style={styles.packageRow}>
                  <View style={styles.packageBody}>
                    <ThemedText type="defaultSemiBold" style={styles.packageTitleUpper}>
                      {(pkg.title ?? 'Package').toUpperCase()}
                    </ThemedText>
                    {pkg.description ? (
                      <ThemedText style={styles.subscribedSubtitle}>{pkg.description}</ThemedText>
                    ) : (
                      <ThemedText style={styles.subscribedSubtitle}>
                        {pkg.ride_credits ?? 0} rides
                      </ThemedText>
                    )}
                  </View>
                  <Pressable
                    onPress={() => onBuy(pkg)}
                    disabled={buyingId === pkg.package_id}
                    style={({ pressed }) => [
                      styles.buyPressable,
                      pressed && buyingId !== pkg.package_id && styles.buyPressed,
                    ]}>
                    <LinearGradient
                      colors={[GRADIENT_RED, GRADIENT_GREEN]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={styles.buyGradient}>
                      {buyingId === pkg.package_id ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.buyText}>{formatPackagePrice(pkg)}</Text>
                      )}
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            ))
          )}

          <View style={[styles.sectionHeadingRow, styles.sectionSpacer]}>
            <ThemedText type="subtitle" style={styles.sectionHeadingFlush}>
              Payment methods
            </ThemedText>
            <Pressable
              hitSlop={12}
              onPress={() => Alert.alert('Payment methods', 'Add payment method is not available yet.')}
              accessibilityRole="button"
              accessibilityLabel="Add payment method">
              <Ionicons name="add" size={26} color="#111111" />
            </Pressable>
          </View>
          {methods.length === 0 ? (
            <ThemedText style={styles.empty}>
              No saved methods. Add rows to `payment_methods` or connect a processor later.
            </ThemedText>
          ) : (
            methods.map((m) => (
              <View key={m.method_id} style={[styles.card, { backgroundColor: cardSurface }]}>
                <View style={styles.paymentRow}>
                  <View style={styles.paymentIconCircle}>
                    <MaterialIcons name="credit-card" size={22} color="#757575" />
                  </View>
                  <View style={styles.paymentTextCol}>
                    <ThemedText type="defaultSemiBold" style={styles.paymentBrand}>
                      {(m.brand ?? m.provider ?? 'Card').toUpperCase()}
                    </ThemedText>
                    <ThemedText style={styles.paymentMasked}>**** {m.last_four ?? '0000'}</ThemedText>
                  </View>
                  {m.is_default ? (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>Default</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ))
          )}

          <ThemedText type="subtitle" style={[styles.sectionHeading, styles.sectionSpacer]}>
            Recent payments
          </ThemedText>
          {payments.length === 0 ? (
            <ThemedText style={styles.empty}>No payment history.</ThemedText>
          ) : (
            payments.map((pay) => (
              <View key={pay.payment_id} style={[styles.card, { backgroundColor: cardSurface }]}>
                <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
                  {pay.currency ?? 'USD'} {pay.amount ?? 0}
                </ThemedText>
                <ThemedText style={styles.muted}>
                  {pay.status ?? 'unknown'} · {pay.method ?? '—'}
                </ThemedText>
              </View>
            ))
          )}
        </View>
      )}
      contentContainerStyle={styles.listContent}
    />
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
  },
  android: { elevation: 3 },
  default: {},
});

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 32,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 0,
  },
  balanceCard: {
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 20,
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: { elevation: 5 },
      default: {},
    }),
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  balanceValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
  },
  balanceValue: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '800',
    lineHeight: 52,
    letterSpacing: -1,
  },
  balanceUnit: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
  },
  sectionHeading: {
    marginTop: 4,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionHeadingFlush: {
    marginBottom: 0,
    marginTop: 0,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    flex: 1,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
    marginBottom: 10,
  },
  sectionBelowBalance: {
    marginTop: 20,
  },
  sectionSpacer: {
    marginTop: 28,
  },
  introMuted: {
    opacity: 0.75,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  muted: {
    opacity: 0.75,
    fontSize: 14,
    lineHeight: 20,
  },
  empty: {
    opacity: 0.7,
    fontStyle: 'italic',
    marginVertical: 10,
    fontSize: 14,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 4,
    marginTop: 8,
    marginBottom: 4,
  },
  historyRowPressed: {
    opacity: 0.7,
  },
  historyIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8E8ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  historyText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    ...cardShadow,
  },
  packageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  packageBody: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  packageTitleUpper: {
    fontSize: 15,
    letterSpacing: 0.4,
  },
  subscribedSubtitle: {
    fontSize: 14,
    color: '#757575',
    lineHeight: 20,
  },
  buyPressable: {
    borderRadius: 999,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  buyPressed: {
    opacity: 0.92,
  },
  buyGradient: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  cardTitle: {
    fontSize: 16,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ECECEF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  paymentTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  paymentBrand: {
    fontSize: 16,
  },
  paymentMasked: {
    fontSize: 14,
    color: '#757575',
  },
  defaultBadge: {
    backgroundColor: DEFAULT_BADGE_BG,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginLeft: 8,
  },
  defaultBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
});
