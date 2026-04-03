import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, type Href } from 'expo-router';
import { memo, useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { createReservation, fetchReservationsForUser } from '@/lib/mobility-api';
import type { ReservationRow } from '@/types/entities';

const PAGE_BG = '#F9F9F9';
const ON_SURFACE = '#111111';
const MUTED_TEXT = '#757575';
const RED_ACCENT = '#FF4B41';
const GRADIENT_GREEN = '#1B4332';
const GRADIENT_RED = '#D90429';
const INPUT_BORDER = 'rgba(0,0,0,0.08)';
const AVATAR_GRADIENT_START = '#6B4540';
const AVATAR_GRADIENT_END = '#2A3D2E';

const CARD_SHADOW = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  android: { elevation: 3 },
  default: {},
});

const MODAL_SHADOW = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  android: { elevation: 16 },
  default: {},
});

function vehicleShortLabel(vehicleId: string): string {
  const short = vehicleId.replace(/-/g, '').slice(0, 4).toUpperCase();
  return `VEHICLE #${short}`;
}

function formatReservationWhen(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .toUpperCase();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date} • ${time}`;
}

type ReservationRowCardProps = {
  item: ReservationRow;
  cardBg: string;
  isDark: boolean;
  colorsText: string;
  onViewDetails: (item: ReservationRow) => void;
  onCancelReservation: () => void;
};

const ReservationRowCard = memo(function ReservationRowCard({
  item,
  cardBg,
  isDark,
  colorsText,
  onViewDetails,
  onCancelReservation,
}: ReservationRowCardProps) {
  const model = item.vehicles?.model?.trim() || 'Scooter';
  const type = item.vehicles?.type?.trim() || '—';
  return (
    <View style={[styles.card, { backgroundColor: cardBg }, !isDark && CARD_SHADOW]}>
      <View style={styles.cardTopRow}>
        <LinearGradient
          colors={[AVATAR_GRADIENT_START, AVATAR_GRADIENT_END]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardIconCircle}>
          <Ionicons name="flash" size={18} color="#FFFFFF" />
        </LinearGradient>
        <View style={styles.cardTitleBlock}>
          <ThemedText
            type="defaultSemiBold"
            style={styles.cardTitle}
            lightColor={ON_SURFACE}
            darkColor={colorsText}>
            {vehicleShortLabel(item.vehicle_id)}
          </ThemedText>
          <ThemedText style={styles.cardSubtitle} lightColor={MUTED_TEXT} darkColor={MUTED_TEXT}>
            {model.toUpperCase()} · {type.toUpperCase()}
          </ThemedText>
          <ThemedText style={styles.cardMeta} lightColor={MUTED_TEXT} darkColor={MUTED_TEXT}>
            Reserved {formatReservationWhen(item.created_at)}
          </ThemedText>
          <ThemedText style={styles.cardMeta} lightColor={MUTED_TEXT} darkColor={MUTED_TEXT}>
            Expires {formatReservationWhen(item.expires_at)}
          </ThemedText>
        </View>
        <View style={[styles.statusPill, isDark && styles.statusPillDark]}>
          <Text style={[styles.statusText, isDark && styles.statusTextDark]}>
            {(item.status ?? '—').toUpperCase()}
          </Text>
        </View>
      </View>
      <View
        style={[
          styles.cardDivider,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
        ]}
      />
      <View
        style={[
          styles.cardActions,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F0F0F0' },
        ]}>
        <Pressable
          style={({ pressed }) => [styles.actionGhost, pressed && styles.actionPressed]}
          onPress={onCancelReservation}
          accessibilityRole="button"
          accessibilityLabel="Cancel reservation">
          <Text style={[styles.actionGhostText, isDark && styles.actionGhostTextDark]}>Cancel</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.detailsBtnWrap, pressed && styles.detailsBtnWrapPressed]}
          onPress={() => onViewDetails(item)}
          accessibilityRole="button"
          accessibilityLabel="View vehicle details">
          <LinearGradient
            colors={[GRADIENT_RED, GRADIENT_GREEN]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.detailsGradient}>
            <Text style={styles.detailsBtnText}>View details</Text>
            <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
});

export default function ReservationsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const cardBg = isDark ? '#1E2122' : '#FFFFFF';
  const modalBg = isDark ? colors.background : '#FFFFFF';
  const inputBorder = isDark ? 'rgba(255,255,255,0.12)' : INPUT_BORDER;
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : '#FAFAFA';
  const pageBg = isDark ? colors.background : PAGE_BG;

  const { user } = useAuth();
  const [items, setItems] = useState<ReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [vehicleIdInput, setVehicleIdInput] = useState('');
  const screenFocusRef = useRef(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      const { data, error } = await fetchReservationsForUser(user.id);
      if (!error && data) setItems(data as ReservationRow[]);
      else setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      const silent = screenFocusRef.current;
      screenFocusRef.current = true;
      void load({ silent });
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const onViewDetails = useCallback((r: ReservationRow) => {
    router.push(`/vehicle/${r.vehicle_id}` as Href);
  }, []);

  const onCancelReservation = useCallback(() => {
    Alert.alert(
      'Cancel reservation',
      'Cancellation is not available in the app yet. Your hold will end automatically at the expiry time, or contact support for help.'
    );
  }, []);

  async function submitReservation() {
    const id = vehicleIdInput.trim();
    if (!id || !user) {
      Alert.alert('Vehicle ID required', 'Paste the vehicle UUID from the map or fleet.');
      return;
    }
    const { error } = await createReservation(user.id, id);
    if (error) {
      Alert.alert('Could not reserve', error.message);
      return;
    }
    setReserveOpen(false);
    setVehicleIdInput('');
    Alert.alert('Reserved', 'Your hold is active until it expires.');
    void load({ silent: true });
  }

  const renderReservationItem = useCallback(
    ({ item }: { item: ReservationRow }) => (
      <ReservationRowCard
        item={item}
        cardBg={cardBg}
        isDark={isDark}
        colorsText={colors.text}
        onViewDetails={onViewDetails}
        onCancelReservation={onCancelReservation}
      />
    ),
    [cardBg, isDark, colors.text, onCancelReservation, onViewDetails]
  );

  if (loading && !refreshing) {
    return (
      <ThemedView style={[styles.centered, { backgroundColor: pageBg }]}>
        <ActivityIndicator size="large" color={RED_ACCENT} />
      </ThemedView>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: pageBg }]}>
      <View style={[styles.toolbar, { backgroundColor: pageBg }]}>
        <View style={styles.toolbarRow}>
          <Pressable
            style={({ pressed }) => [styles.mapBtnWrap, pressed && styles.mapBtnWrapPressed]}
            onPress={() => router.push('/(tabs)/map' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Find vehicle on map">
            <LinearGradient
              colors={[GRADIENT_RED, GRADIENT_GREEN]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.mapBtnGradient}>
              <MaterialIcons name="map" size={20} color="#FFFFFF" />
              <Text style={styles.mapBtnText}>Find on map</Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.secondaryBtnPressed]}
            onPress={() => setReserveOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Reserve by entering vehicle ID">
            <Ionicons name="create-outline" size={20} color={RED_ACCENT} />
            <Text style={styles.secondaryBtnText}>Enter vehicle ID</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={reserveOpen} transparent animationType="slide">
        <Pressable style={styles.modalBackdrop} onPress={() => setReserveOpen(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: modalBg }, MODAL_SHADOW]} onPress={() => {}}>
            <ThemedText
              type="subtitle"
              style={styles.modalTitle}
              lightColor={ON_SURFACE}
              darkColor={colors.text}>
              Reserve by vehicle ID
            </ThemedText>
            <ThemedText style={styles.modalHint} lightColor={MUTED_TEXT} darkColor={colors.icon}>
              Paste the UUID shown on the map detail sheet.
            </ThemedText>
            <TextInput
              value={vehicleIdInput}
              onChangeText={setVehicleIdInput}
              placeholder="Vehicle UUID"
              placeholderTextColor={MUTED_TEXT}
              autoCapitalize="none"
              style={[
                styles.input,
                {
                  borderColor: inputBorder,
                  backgroundColor: inputBg,
                  color: colors.text,
                },
              ]}
            />
            <View style={styles.modalRow}>
              <Pressable
                style={({ pressed }) => [styles.modalCancel, pressed && styles.modalCancelPressed]}
                onPress={() => setReserveOpen(false)}>
                <Text style={[styles.modalCancelText, isDark && styles.modalCancelTextDark]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalOk, pressed && styles.modalOkPressed]}
                onPress={submitReservation}>
                <Text style={styles.modalOkText}>Reserve</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <FlatList
        data={items}
        keyExtractor={(r) => r.reservation_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        style={{ backgroundColor: pageBg }}
        ListHeaderComponent={
          <ThemedText
            type="subtitle"
            style={styles.sectionHeading}
            lightColor={ON_SURFACE}
            darkColor={colors.text}>
            YOUR RESERVATIONS
          </ThemedText>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <ThemedText style={styles.empty} lightColor={MUTED_TEXT} darkColor={MUTED_TEXT}>
              No reservations yet. Find a scooter on the map or enter a vehicle ID to reserve.
            </ThemedText>
          </View>
        }
        renderItem={renderReservationItem}
        extraData={cardBg}
        contentContainerStyle={[styles.list, { backgroundColor: pageBg }]}
        windowSize={7}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  toolbar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  mapBtnWrap: {
    flex: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
  mapBtnWrapPressed: {
    opacity: 0.92,
  },
  mapBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  mapBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15, letterSpacing: 0.2 },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 65, 0.55)',
    backgroundColor: 'transparent',
  },
  secondaryBtnPressed: {
    opacity: 0.88,
  },
  secondaryBtnText: {
    color: RED_ACCENT,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.15,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 56,
    gap: 14,
  },
  sectionHeading: {
    marginTop: 8,
    marginBottom: 14,
    alignSelf: 'flex-start',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1,
  },
  card: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 0,
    overflow: 'hidden',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingBottom: 6,
  },
  cardIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    paddingTop: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.35,
  },
  cardSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  cardMeta: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  statusPill: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F0F0F0',
  },
  statusPillDark: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.65,
    color: MUTED_TEXT,
  },
  statusTextDark: {
    color: '#B0B0B0',
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 12,
    marginHorizontal: -16,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  actionGhost: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  actionPressed: {
    opacity: 0.75,
  },
  actionGhostText: {
    fontSize: 14,
    fontWeight: '700',
    color: RED_ACCENT,
    letterSpacing: 0.2,
  },
  actionGhostTextDark: {
    color: '#FF6B62',
  },
  detailsBtnWrap: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  detailsBtnWrapPressed: {
    opacity: 0.92,
  },
  detailsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  detailsBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.25,
  },
  emptyWrap: { paddingVertical: 28, paddingHorizontal: 8 },
  empty: { textAlign: 'center', fontSize: 14, lineHeight: 20 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 36,
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  modalHint: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.85,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  modalCancel: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 65, 0.45)',
    backgroundColor: 'transparent',
  },
  modalCancelPressed: {
    opacity: 0.88,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: RED_ACCENT,
  },
  modalCancelTextDark: {
    color: '#FF6B62',
  },
  modalOk: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 999,
    minWidth: 112,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RED_ACCENT,
  },
  modalOkPressed: {
    opacity: 0.92,
  },
  modalOkText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.2,
  },
});