import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
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
import { createSupportTicket, fetchSupportTickets } from '@/lib/mobility-api';
import type { TicketRow } from '@/types/entities';

const PAGE_BG = '#F9F9F9';
const ON_SURFACE = '#111111';
const MUTED_TEXT = '#757575';
const RED_ACCENT = '#FF4B41';
const INPUT_BORDER = 'rgba(0,0,0,0.08)';
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

export default function SupportScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const cardBg = isDark ? '#1E2122' : '#FFFFFF';
  const modalBg = isDark ? colors.background : '#FFFFFF';
  const inputBorder = isDark ? 'rgba(255,255,255,0.12)' : INPUT_BORDER;
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : '#FAFAFA';

  const { user } = useAuth();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const screenFocusRef = useRef(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      const { data, error } = await fetchSupportTickets(user.id);
      if (!error && data) setTickets(data);
      else setTickets([]);
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

  async function submitTicket() {
    if (!user) return;
    if (!subject.trim() || !description.trim()) {
      Alert.alert('Missing info', 'Add a subject and description.');
      return;
    }
    setSending(true);
    const { error } = await createSupportTicket(user.id, subject.trim(), description.trim());
    setSending(false);
    if (error) {
      Alert.alert('Could not create ticket', error.message);
      return;
    }
    setOpen(false);
    setSubject('');
    setDescription('');
    void load({ silent: true });
  }

  if (loading && !refreshing) {
    return (
      <ThemedView style={[styles.centered, { backgroundColor: PAGE_BG }]}>
        <ActivityIndicator size="large" color={LoaderAccent} />
      </ThemedView>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: PAGE_BG }]}>
      <View style={styles.toolbar}>
        <Pressable
          style={({ pressed }) => [styles.newBtn, pressed && styles.newBtnPressed]}
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Create new support ticket">
          <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
          <Text style={styles.newBtnText}>New ticket</Text>
        </Pressable>
      </View>
      <FlatList
        data={tickets}
        keyExtractor={(t) => t.ticket_id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={LoaderAccent}
            colors={[LoaderAccent]}
          />
        }
        style={{ backgroundColor: PAGE_BG }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <ThemedText style={styles.empty} lightColor={MUTED_TEXT} darkColor={MUTED_TEXT}>
              No support tickets yet.
            </ThemedText>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: cardBg }, !isDark && CARD_SHADOW]}>
            <ThemedText
              type="defaultSemiBold"
              style={styles.cardTitle}
              lightColor={ON_SURFACE}
              darkColor={colors.text}>
              {item.subject ?? 'Ticket'}
            </ThemedText>
            <ThemedText style={styles.cardBody} lightColor={MUTED_TEXT} darkColor={colors.icon}>
              {item.description ?? ''}
            </ThemedText>
            <View style={[styles.statusPill, isDark && styles.statusPillDark]}>
              <Text style={[styles.statusText, isDark && styles.statusTextDark]}>
                {(item.status ?? '—').toUpperCase()}
              </Text>
            </View>
          </View>
        )}
        contentContainerStyle={styles.list}
      />

      <Modal visible={open} transparent animationType="slide">
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: modalBg }, MODAL_SHADOW]} onPress={() => {}}>
            <ThemedText
              type="subtitle"
              style={styles.modalTitle}
              lightColor={ON_SURFACE}
              darkColor={colors.text}>
              Contact support
            </ThemedText>
            <TextInput
              placeholder="Subject"
              placeholderTextColor={MUTED_TEXT}
              value={subject}
              onChangeText={setSubject}
              style={[
                styles.input,
                {
                  borderColor: inputBorder,
                  backgroundColor: inputBg,
                  color: colors.text,
                },
              ]}
            />
            <TextInput
              placeholder="Describe the issue"
              placeholderTextColor={MUTED_TEXT}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              style={[
                styles.input,
                styles.textArea,
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
                onPress={() => setOpen(false)}>
                <Text style={[styles.modalCancelText, isDark && styles.modalCancelTextDark]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalOk,
                  pressed && styles.modalOkPressed,
                  sending && styles.modalOkDisabled,
                ]}
                onPress={submitTicket}
                disabled={sending}>
                {sending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalOkText}>Submit</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  toolbar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: PAGE_BG,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: RED_ACCENT,
  },
  newBtnPressed: {
    opacity: 0.92,
  },
  newBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15, letterSpacing: 0.2 },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 56,
    gap: 14,
    backgroundColor: PAGE_BG,
  },
  card: {
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  statusPill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 12,
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
  emptyWrap: { paddingVertical: 40, paddingHorizontal: 16 },
  empty: { textAlign: 'center', fontSize: 14 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
    gap: 14,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
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
  modalOkDisabled: {
    opacity: 0.65,
  },
  modalOkText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.2,
  },
});
