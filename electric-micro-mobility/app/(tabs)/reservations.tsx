import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, type Href } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
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
import { Colors, LoaderAccent } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { cancelReservation, createReservation, fetchReservationsForUser } from '@/lib/mobility-api';
import type { ReservationRow } from '@/types/entities';

const PAGE_BG = '#F9F9F9';
const ON_SURFACE = '#111111';
const MUTED_TEXT = '#757575';
const RED_ACCENT = '#FF4B41';
const GRADIENT_GREEN = '#1B4332';
const GRADIENT_RED = '#D90429';
const GRADIENT_BLACK = '#11181C';
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

function isActiveReservation(item: ReservationRow): boolean {
  if ((item.status ?? '').toLowerCase() !== 'active') return false;
  if (!item.expires_at) return true;
  const expiresMs = new Date(item.expires_at).getTime();
  if (Number.isNaN(expiresMs)) return true;
  return expiresMs > Date.now();
}

type ReservationRowCardProps = {
  item: ReservationRow;
  cardBg: string;
  isDark: boolean;
  colorsText: string;
  cancelling: boolean;
  onViewDetails: (item: ReservationRow) => void;
  onCancelReservation: (item: ReservationRow) => void;
};

type CancelReservationSelection = {
  reservation_id: string;
  vehicle_id: string;
  status: string | null;
};

const ReservationRowCard = memo(function ReservationRowCard({
  item,
  cardBg,
  isDark,
  colorsText,
  cancelling,
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
          style={({ pressed }) => [
            styles.actionDangerBtn,
            (pressed || cancelling) && styles.actionPressed,
          ]}
          onPress={() => onCancelReservation(item)}
          disabled={cancelling}
          accessibilityRole="button"
          accessibilityLabel="Cancel reservation">
          {cancelling ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <View style={styles.actionDangerBtnInner}>
              <Ionicons name="close-circle-outline" size={16} color="#FFFFFF" />
              <Text style={styles.actionDangerText}>Remove reservation</Text>
            </View>
          )}
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
  const [cancellingReservationId, setCancellingReservationId] = useState<string | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<CancelReservationSelection | null>(null);
  const selectedReservationRef = useRef<CancelReservationSelection | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [deleteSuccessOpen, setDeleteSuccessOpen] = useState(false);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState('');
  const screenFocusRef = useRef(false);

  useEffect(() => {
    selectedReservationRef.current = selectedReservation;
    console.log('[Reservations] selectedReservation state updated', {
      selectedReservation,
      reservation_id: selectedReservation?.reservation_id ?? null,
    });
  }, [selectedReservation]);

  useEffect(() => {
    console.log('[Reservations] cancel confirm modal state changed', {
      open: cancelConfirmOpen,
      reservation_id: selectedReservationRef.current?.reservation_id ?? null,
    });
  }, [cancelConfirmOpen]);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!user) return [] as ReservationRow[];
    if (!silent) setLoading(true);
    try {
      const { data, error } = await fetchReservationsForUser(user.id);
      if (!error && data) {
        const allRows = data as ReservationRow[];
        const activeRows = allRows.filter(isActiveReservation);
        console.log('[Reservations] load()', {
          userId: user.id,
          rawCount: allRows.length,
          rawReservationIds: allRows.map((row) => row.reservation_id),
          activeCount: activeRows.length,
          activeReservationIds: activeRows.map((row) => row.reservation_id),
        });
        setItems(activeRows);
        return activeRows;
      }
      console.log('[Reservations] load() failed', { userId: user.id, error: error?.message ?? 'unknown' });
      setItems([]);
      return [] as ReservationRow[];
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

  const onCancelReservation = useCallback(
    (reservation: ReservationRow) => {
      if (!user) return;
      const nextSelection: CancelReservationSelection = {
        reservation_id: reservation.reservation_id,
        vehicle_id: reservation.vehicle_id,
        status: reservation.status ?? null,
      };
      const status = (nextSelection.status ?? '').toLowerCase();
      if (status !== 'active') {
        Alert.alert('Cannot cancel', 'Only active reservations can be cancelled.');
        return;
      }
      console.log('[Reservations] cancel button clicked', {
        clickedReservationId: reservation.reservation_id,
        clickedVehicleId: reservation.vehicle_id,
        clickedStatus: reservation.status ?? null,
        nextSelection,
      });
      selectedReservationRef.current = nextSelection;
      console.log('[Reservations] setSelectedReservation requested', {
        reservation_id: nextSelection.reservation_id,
        vehicle_id: nextSelection.vehicle_id,
        status: nextSelection.status,
      });
      setSelectedReservation(nextSelection);
      setCancelConfirmOpen(true);
      console.log('[Reservations] cancel confirm modal opening', {
        reservation_id: nextSelection.reservation_id,
      });
    },
    [user]
  );

  const closeCancelConfirm = useCallback(() => {
    setCancelConfirmOpen(false);
    setSelectedReservation(null);
    selectedReservationRef.current = null;
  }, []);

  const onConfirmCancelReservation = useCallback(async () => {
    if (!user) return;
    const currentSelection = selectedReservationRef.current;
    const reservationId = currentSelection?.reservation_id?.trim();
    if (!reservationId) {
      Alert.alert('Cancellation failed', 'Missing reservation_id for selected row.');
      return;
    }
    setCancelConfirmOpen(false);
    setCancellingReservationId(reservationId);
    console.log('[Reservations] confirm cancel pressed -> API request', {
      userId: user.id,
      selectedReservation: currentSelection,
      reservation_id: reservationId,
    });
    try {
      const { data: deleteResult, error } = await cancelReservation(user.id, reservationId);
      if (error) {
        Alert.alert('Cancellation failed', error.message);
        return;
      }
      if (!deleteResult?.ok) {
        Alert.alert('Cancellation failed', 'Server did not confirm deletion.');
        return;
      }
      const refreshedItems = await load({ silent: true });
      const stillPresent = refreshedItems.some((x) => x.reservation_id === reservationId);
      console.log('[Reservations] remove post-refetch check', {
        reservation_id: reservationId,
        stillPresentInActiveList: stillPresent,
        refreshedReservationIds: refreshedItems.map((x) => x.reservation_id),
      });
      if (stillPresent) {
        Alert.alert(
          'Removal not confirmed',
          'Reservation still appears after refresh. Please retry and check backend logs.'
        );
        return;
      }
      setDeleteSuccessMessage(deleteResult.message?.trim() || 'Your vehicle hold has been released.');
      setDeleteSuccessOpen(true);
    } finally {
      setCancellingReservationId(null);
      setSelectedReservation(null);
      selectedReservationRef.current = null;
    }
  }, [load, user]);

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
        cancelling={cancellingReservationId === item.reservation_id}
        onViewDetails={onViewDetails}
        onCancelReservation={onCancelReservation}
      />
    ),
    [cancellingReservationId, cardBg, isDark, colors.text, onCancelReservation, onViewDetails]
  );

  if (loading && !refreshing) {
    return (
      <ThemedView style={[styles.centered, { backgroundColor: pageBg }]}>
        <ActivityIndicator size="large" color={LoaderAccent} />
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

      <Modal
        visible={cancelConfirmOpen}
        transparent
        animationType="fade"
        onRequestClose={closeCancelConfirm}>
        <View style={styles.successOverlay}>
          <View
            style={[
              styles.successCard,
              {
                backgroundColor: isDark ? '#151718' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(17,24,28,0.08)',
              },
            ]}>
            <LinearGradient colors={[GRADIENT_RED, GRADIENT_BLACK]} style={styles.successIconWrap}>
              <Ionicons name="alert-circle-outline" size={28} color="#FFFFFF" />
            </LinearGradient>
            <ThemedText
              type="subtitle"
              style={styles.successTitle}
              lightColor={ON_SURFACE}
              darkColor={colors.text}>
              Cancel reservation
            </ThemedText>
            <ThemedText style={styles.successSubtitle} lightColor={MUTED_TEXT} darkColor={colors.icon}>
              Do you want to cancel reservation #{selectedReservation?.reservation_id?.slice(0, 8).toUpperCase() ?? 'N/A'} now?
            </ThemedText>
            <View style={styles.modalRow}>
              <Pressable
                style={({ pressed }) => [styles.modalCancel, pressed && styles.modalCancelPressed]}
                onPress={closeCancelConfirm}>
                <Text style={[styles.modalCancelText, isDark && styles.modalCancelTextDark]}>Keep</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalOk, pressed && styles.modalOkPressed]}
                onPress={() => {
                  void onConfirmCancelReservation();
                }}>
                <Text style={styles.modalOkText}>Cancel reservation</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={deleteSuccessOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteSuccessOpen(false)}>
        <View style={styles.successOverlay}>
          <View
            style={[
              styles.successCard,
              {
                backgroundColor: isDark ? '#151718' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(17,24,28,0.08)',
              },
            ]}>
            <LinearGradient colors={[GRADIENT_RED, GRADIENT_BLACK]} style={styles.successIconWrap}>
              <Ionicons name="checkmark" size={28} color="#FFFFFF" />
            </LinearGradient>
            <ThemedText
              type="subtitle"
              style={styles.successTitle}
              lightColor={ON_SURFACE}
              darkColor={colors.text}>
              Delete successful
            </ThemedText>
            <ThemedText style={styles.successSubtitle} lightColor={MUTED_TEXT} darkColor={colors.icon}>
              {deleteSuccessMessage}
            </ThemedText>
            <Pressable style={styles.successButton} onPress={() => setDeleteSuccessOpen(false)}>
              <Text style={styles.successButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <FlatList
        data={items}
        keyExtractor={(r) => r.reservation_id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={LoaderAccent}
            colors={[LoaderAccent]}
          />
        }
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
  actionDangerBtn: {
    minHeight: 40,
    minWidth: 158,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D90429',
  },
  actionPressed: {
    opacity: 0.75,
  },
  actionDangerBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionDangerText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.15,
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
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8,12,14,0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  successCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  successIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  successSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    opacity: 0.88,
  },
  successButton: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: RED_ACCENT,
    minHeight: 44,
    minWidth: 136,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  successButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
});