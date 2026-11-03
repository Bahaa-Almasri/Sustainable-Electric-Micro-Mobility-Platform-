import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ListScreenSkeleton } from '@/components/screen-skeletons';
import { Button, Card, EmptyNote, Field, PageHeader, SectionTitle, StatusPill } from '@/components/wayfinder/ui';
import { LoaderAccent, Type } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTabBarSpace, useWayfinder } from '@/hooks/use-wayfinder';
import { createSupportTicket, fetchSupportTickets } from '@/lib/mobility-api';
import type { TicketRow } from '@/types/entities';

function formatDay(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function statusLabel(status: string | null): string {
  const s = (status ?? '').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '—';
}

export default function SupportScreen() {
  const { c } = useWayfinder();
  const tabBarSpace = useTabBarSpace();
  const { user } = useAuth();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const screenFocusRef = useRef(false);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
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
    },
    [user]
  );

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

  function clearForm() {
    setSubject('');
    setDescription('');
  }

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
    clearForm();
    void load({ silent: true });
  }

  if (loading && !refreshing) {
    return <ListScreenSkeleton pageBg={c.bg} withHeading={false} />;
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: c.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LoaderAccent} colors={[LoaderAccent]} />
        }>
        <View style={styles.pageHeader}>
          <PageHeader title="Support" subtitle="Tell us what went wrong." />
        </View>

        <Card style={styles.form}>
          <SectionTitle title="New ticket" />
          <Field label="Subject" placeholder="Subject" value={subject} onChangeText={setSubject} style={styles.field} />
          <Field
            label="Description"
            placeholder="Describe the issue"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            style={styles.field}
          />
          <View style={styles.actions}>
            <Button label="Cancel" variant="secondary" onPress={clearForm} disabled={sending} height={50} radius={16} style={styles.flex} />
            <Button label="Submit" onPress={() => void submitTicket()} loading={sending} height={50} radius={16} style={styles.submit} />
          </View>
        </Card>

        <SectionTitle title="Your tickets" style={styles.section} />
        {tickets.length === 0 ? (
          <View style={styles.pad}>
            <EmptyNote text="No support tickets yet." />
          </View>
        ) : (
          <Card style={styles.list}>
            {tickets.map((item, i) => {
              const status = (item.status ?? '').toLowerCase();
              const done = status === 'resolved' || status === 'closed';
              const color = done ? c.success : status ? c.warning : c.muted;
              return (
                <View key={item.ticket_id} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
                  <View style={done ? [styles.dot, { backgroundColor: color }] : [styles.dot, styles.ring, { borderColor: color }]} />
                  <View style={styles.rowText}>
                    <Text style={[Type.body, { color: c.text }]} numberOfLines={1}>
                      {item.subject ?? 'Ticket'}
                    </Text>
                    {item.description ? (
                      <Text style={[Type.secondary, { color: c.muted }]} numberOfLines={2}>
                        {item.description}
                      </Text>
                    ) : null}
                    <Text style={[Type.secondary, { color: c.muted }]} numberOfLines={1}>
                      #{item.ticket_id.slice(0, 6).toUpperCase()}
                      {formatDay(item.created_at) ? ` · ${formatDay(item.created_at)}` : ''}
                    </Text>
                  </View>
                  <StatusPill label={statusLabel(item.status)} color={color} />
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
  pageHeader: { marginHorizontal: -16 },
  pad: { paddingHorizontal: 8 },
  form: { borderRadius: 26, padding: 20 },
  field: { marginTop: 14 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  submit: { flex: 2 },
  section: { marginTop: 22, marginBottom: 12, marginHorizontal: 8 },
  list: { paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  ring: { borderWidth: 3 },
  rowText: { flex: 1, minWidth: 0 },
});
