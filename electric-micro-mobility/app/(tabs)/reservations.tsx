import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
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

export default function ReservationsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user } = useAuth();
  const [items, setItems] = useState<ReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [vehicleIdInput, setVehicleIdInput] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await fetchReservationsForUser(user.id);
    if (!error && data) setItems(data as ReservationRow[]);
    else setItems([]);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

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
    load();
  }

  if (loading && !refreshing) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={[styles.actions, { borderBottomColor: colors.icon }]}>
        <Pressable
          style={[styles.actionBtn, { backgroundColor: colors.tint }]}
          onPress={() => router.push('/(tabs)/map' as Href)}>
          <ThemedText style={styles.actionBtnText}>Find on map</ThemedText>
        </Pressable>
        <Pressable
          style={[styles.actionBtnOutline, { borderColor: colors.tint }]}
          onPress={() => setReserveOpen(true)}>
          <ThemedText style={{ color: colors.tint, fontWeight: '600' }}>Enter vehicle ID</ThemedText>
        </Pressable>
      </View>
      <Modal visible={reserveOpen} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setReserveOpen(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.background }]} onPress={() => {}}>
            <ThemedText type="subtitle">Reserve by vehicle ID</ThemedText>
            <ThemedText style={styles.muted}>Paste the UUID shown on the map detail sheet.</ThemedText>
            <TextInput
              value={vehicleIdInput}
              onChangeText={setVehicleIdInput}
              placeholder="Vehicle UUID"
              placeholderTextColor={colors.icon}
              autoCapitalize="none"
              style={[styles.input, { borderColor: colors.icon, color: colors.text }]}
            />
            <View style={styles.modalRow}>
              <Pressable style={styles.modalCancel} onPress={() => setReserveOpen(false)}>
                <ThemedText>Cancel</ThemedText>
              </Pressable>
              <Pressable style={[styles.modalOk, { backgroundColor: colors.tint }]} onPress={submitReservation}>
                <ThemedText style={styles.actionBtnText}>Reserve</ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <FlatList
        data={items}
        keyExtractor={(r) => r.reservation_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <ThemedView style={styles.emptyWrap}>
            <ThemedText style={styles.empty}>No reservations yet.</ThemedText>
          </ThemedView>
        }
        renderItem={({ item }) => (
          <ThemedView style={[styles.card, { borderColor: colors.icon }]}>
            <ThemedText type="defaultSemiBold">
              {item.vehicles?.model ?? 'Vehicle'} · {item.vehicles?.type ?? '—'}
            </ThemedText>
            <ThemedText style={styles.muted}>Status: {item.status ?? '—'}</ThemedText>
            <ThemedText style={styles.muted}>Expires: {item.expires_at ?? '—'}</ThemedText>
          </ThemedView>
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  actions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontWeight: '600' },
  actionBtnOutline: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  list: { padding: 16, paddingBottom: 40, gap: 12 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  muted: { opacity: 0.75, fontSize: 14 },
  emptyWrap: { padding: 24 },
  empty: { opacity: 0.7, textAlign: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 14,
    padding: 20,
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  modalRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  modalCancel: { paddingVertical: 10, paddingHorizontal: 14 },
  modalOk: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 },
});
