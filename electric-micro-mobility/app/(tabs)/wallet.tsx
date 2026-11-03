import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { WalletSkeleton } from '@/components/screen-skeletons';
import { RouteIcon, TicketIcon } from '@/components/wayfinder/icons';
import { Button, Card, DashedLine, EmptyNote, PageHeader, SectionTitle, StatusPill } from '@/components/wayfinder/ui';
import { FontFamily, LoaderAccent, Type } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTabBarSpace, useWayfinder } from '@/hooks/use-wayfinder';
import { fetchRidePackages, fetchWalletOverview, purchaseRidePackage } from '@/lib/mobility-api';
import type { PackageRow, PaymentMethodRow, PaymentRow, PurchaseRow } from '@/types/entities';

function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  const cur = currency ?? 'USD';
  const value = Number(amount ?? 0);
  if (cur === 'USD' || cur === '$') return `$${value.toFixed(2)}`;
  return `${cur} ${value.toFixed(2)}`;
}

function formatDay(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function methodLabel(m: PaymentMethodRow): string {
  return `${m.brand ?? m.provider ?? 'Card'} •• ${m.last_four ?? '0000'}`;
}

/** Package with the lowest price per ride, highlighted in the row. */
function bestValueId(packages: PackageRow[]): string | null {
  let best: { id: string; perRide: number } | null = null;
  for (const pkg of packages) {
    const rides = pkg.ride_credits ?? 0;
    if (rides <= 0 || pkg.price == null) continue;
    const perRide = pkg.price / rides;
    if (!best || perRide < best.perRide) best = { id: pkg.package_id, perRide };
  }
  return best?.id ?? null;
}

export default function WalletScreen() {
  const { c } = useWayfinder();
  const tabBarSpace = useTabBarSpace();
  const { user } = useAuth();

  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [methods, setMethods] = useState<PaymentMethodRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const screenFocusRef = useRef(false);

  const totalRidesRemaining = useMemo(
    () => purchases.reduce((s, p) => s + (p.rides_remaining ?? 0), 0),
    [purchases]
  );
  const defaultMethod = useMemo(() => methods.find((m) => m.is_default) ?? methods[0] ?? null, [methods]);
  const highlightedId = useMemo(() => bestValueId(packages), [packages]);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
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
    },
    [user]
  );

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

  function onBuy(pkg: PackageRow) {
    if (!user) return;
    Alert.alert('Purchase package', `Buy "${pkg.title ?? 'Package'}" for ${formatMoney(pkg.price, pkg.currency)}?`, [
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
    ]);
  }

  function onPaymentMethods() {
    Alert.alert('Payment methods', 'Add payment method is not available yet.');
  }

  if (loading && !refreshing) {
    return <WalletSkeleton pageBg={c.bg} cardBg={c.surface} />;
  }

  const currentPurchase = purchases[0] ?? null;

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LoaderAccent} colors={[LoaderAccent]} />
      }>
      <View style={styles.pageHeader}>
        <PageHeader title="Wallet" />
      </View>

      <View style={[styles.balance, { backgroundColor: c.accent }]}>
        <View style={styles.balanceTop}>
          <Text style={[Type.label, styles.balanceLabel, { color: c.onAccent }]}>AVAILABLE RIDES</Text>
          <View style={styles.balanceRow}>
            <Text style={[styles.balanceValue, { color: c.onAccent }]}>{totalRidesRemaining}</Text>
            <Text style={[styles.balanceUnit, { color: c.onAccent }]}>rides</Text>
          </View>
        </View>
        <View style={styles.tear}>
          <View style={[styles.notch, styles.notchLeft, { backgroundColor: c.bg }]} />
          <DashedLine color={c.onAccent} style={styles.tearLine} />
          <View style={[styles.notch, styles.notchRight, { backgroundColor: c.bg }]} />
        </View>
        <View style={styles.balanceBottom}>
          <Text style={[styles.balanceMeta, { color: c.onAccent }]} numberOfLines={1}>
            {currentPurchase
              ? `${currentPurchase.ride_packages?.title ?? 'Package'} · ${currentPurchase.rides_remaining ?? 0} left`
              : 'No package yet'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Payment methods"
            onPress={onPaymentMethods}
            hitSlop={12}>
            <Text style={[styles.balanceCard, { color: c.onAccent }]} numberOfLines={1}>
              {defaultMethod ? methodLabel(defaultMethod) : 'Add card +'}
            </Text>
          </Pressable>
        </View>
      </View>

      <SectionTitle title="Ride packages" style={styles.section} />
      {packages.length === 0 ? (
        <View style={styles.pad}>
          <EmptyNote text="No packages available yet." />
        </View>
      ) : (
        <View style={styles.packages}>
          {packages.map((pkg) => {
            const featured = pkg.package_id === highlightedId;
            return (
              <View
                key={pkg.package_id}
                style={[
                  styles.package,
                  featured
                    ? { backgroundColor: c.inverse, borderColor: c.inverse }
                    : { backgroundColor: c.surface, borderColor: c.line },
                ]}>
                <Text
                  style={[styles.packageName, { color: featured ? c.accent : c.muted }]}
                  numberOfLines={1}>
                  {pkg.title ?? 'Package'}
                </Text>
                <Text style={[styles.packageCount, { color: featured ? c.inverseText : c.text }]}>
                  {pkg.ride_credits ?? 0}
                </Text>
                <Text style={[Type.label, { color: featured ? c.inverseMuted : c.muted }]}>RIDES</Text>
                <DashedLine color={featured ? c.inverseMuted : c.line} style={styles.packageTear} />
                <Button
                  label={formatMoney(pkg.price, pkg.currency)}
                  variant={featured ? 'primary' : 'secondary'}
                  onPress={() => onBuy(pkg)}
                  loading={buyingId === pkg.package_id}
                  height={44}
                  radius={14}
                  style={styles.buy}
                  accessibilityLabel={`Buy ${pkg.title ?? 'package'} for ${formatMoney(pkg.price, pkg.currency)}`}
                />
              </View>
            );
          })}
        </View>
      )}

      {purchases.length > 0 ? (
        <>
          <SectionTitle title="Your packages" style={styles.section} />
          <Card style={styles.list}>
            {purchases.map((p, i) => (
              <View key={p.purchase_id} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
                <View style={[styles.rowIcon, { backgroundColor: c.accentSoft }]}>
                  <TicketIcon color={c.accentText} size={20} />
                </View>
                <Text style={[Type.body, styles.rowText, { color: c.text }]} numberOfLines={1}>
                  {p.ride_packages?.title ?? 'Package'}
                </Text>
                <Text style={[Type.secondary, { color: c.muted }]}>{p.rides_remaining ?? 0} rides left</Text>
              </View>
            ))}
          </Card>
        </>
      ) : (
        <View style={styles.pad}>
          <EmptyNote text="No purchases yet." />
        </View>
      )}

      <View style={[styles.sectionRow, styles.section]}>
        <SectionTitle title="Payment methods" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add payment method"
          onPress={onPaymentMethods}
          hitSlop={12}>
          <Ionicons name="add" size={26} color={c.text} />
        </Pressable>
      </View>
      {methods.length === 0 ? (
        <View style={styles.pad}>
          <EmptyNote text="No saved payment methods." />
        </View>
      ) : (
        <Card style={styles.list}>
          {methods.map((m, i) => (
            <View key={m.method_id} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
              <View style={[styles.rowIcon, { backgroundColor: c.tile }]}>
                <MaterialIcons name="credit-card" size={20} color={c.text} />
              </View>
              <Text style={[Type.body, styles.rowText, { color: c.text }]} numberOfLines={1}>
                {methodLabel(m)}
              </Text>
              {m.is_default ? <StatusPill label="Default" color={c.muted} /> : null}
            </View>
          ))}
        </Card>
      )}

      <SectionTitle title="Recent payments" style={styles.section} />
      {payments.length === 0 ? (
        <View style={styles.pad}>
          <EmptyNote text="No payment history." />
        </View>
      ) : (
        <Card style={styles.list}>
          {payments.map((pay, i) => (
            <View key={pay.payment_id} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
              <View style={[styles.rowIcon, { backgroundColor: c.accentSoft }]}>
                <TicketIcon color={c.accentText} size={20} />
              </View>
              <View style={styles.rowText}>
                <Text style={[Type.body, { color: c.text }]} numberOfLines={1}>
                  Payment
                </Text>
                <Text style={[Type.secondary, styles.capitalize, { color: c.muted }]} numberOfLines={1}>
                  {[formatDay(pay.created_at), pay.status ?? 'unknown', pay.method?.replace(/_/g, ' ')].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Text style={[styles.amount, { color: c.text }]}>{formatMoney(pay.amount, pay.currency)}</Text>
            </View>
          ))}
        </Card>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View ride history"
        onPress={() => router.push('/(tabs)/account' as Href)}
        style={({ pressed }) => [styles.history, { borderColor: c.line, opacity: pressed ? 0.8 : 1 }]}>
        <View style={[styles.rowIcon, { backgroundColor: c.tile }]}>
          <RouteIcon color={c.text} size={20} />
        </View>
        <Text style={[Type.body, styles.rowText, { color: c.text }]}>View ride history</Text>
        <Ionicons name="chevron-forward" size={18} color={c.muted} />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
  pageHeader: { marginHorizontal: -16 },
  pad: { paddingHorizontal: 8 },
  balance: { borderRadius: 26 },
  balanceTop: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  balanceLabel: { fontFamily: FontFamily.bold },
  balanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 },
  balanceValue: { fontFamily: FontFamily.display, fontSize: 76, lineHeight: 80, letterSpacing: -3 },
  balanceUnit: { fontFamily: FontFamily.bold, fontSize: 17 },
  tear: { height: 24, justifyContent: 'center' },
  tearLine: { marginHorizontal: 18, opacity: 0.45 },
  notch: { position: 'absolute', top: 0, width: 24, height: 24, borderRadius: 12 },
  notchLeft: { left: -12 },
  notchRight: { right: -12 },
  balanceBottom: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingBottom: 14 },
  balanceMeta: { flex: 1, fontFamily: FontFamily.semibold, fontSize: 14 },
  balanceCard: { fontFamily: FontFamily.bold, fontSize: 14 },
  section: { marginTop: 22, marginBottom: 12, marginHorizontal: 8 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  packages: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  package: { flexGrow: 1, flexBasis: '30%', borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 14 },
  packageName: { fontFamily: FontFamily.bold, fontSize: 14 },
  packageCount: { fontFamily: FontFamily.display, fontSize: 36, lineHeight: 42, letterSpacing: -1 },
  packageTear: { marginVertical: 12 },
  buy: { paddingHorizontal: 2 },
  list: { paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  capitalize: { textTransform: 'capitalize' },
  amount: { fontFamily: FontFamily.display, fontSize: 18 },
  history: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, padding: 12, borderWidth: 1, borderRadius: 20 },
});
