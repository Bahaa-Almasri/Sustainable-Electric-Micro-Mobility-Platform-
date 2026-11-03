import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { RouteIcon } from '@/components/wayfinder/icons';
import { Card } from '@/components/wayfinder/ui';
import { FontFamily, Type } from '@/constants/theme';
import { useWayfinder } from '@/hooks/use-wayfinder';
import type { RideRow } from '@/types/entities';

function rideDurationMinutes(r: RideRow): number | null {
  if (!r.start_time || !r.end_time) return null;
  const a = new Date(r.start_time).getTime();
  const b = new Date(r.end_time).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  return Math.max(1, Math.round((b - a) / 60000));
}

function formatRideWhen(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} · ${time}`;
}

function vehicleLabel(vehicleId: string): string {
  return `Vehicle #${vehicleId.replace(/-/g, '').slice(0, 4).toUpperCase()}`;
}

export type RidePreviewCardProps = {
  item: RideRow;
};

export const RidePreviewCard = memo(function RidePreviewCard({ item }: RidePreviewCardProps) {
  const { c } = useWayfinder();
  const mins = rideDurationMinutes(item);
  return (
    <Card style={styles.card}>
      <View style={[styles.icon, { backgroundColor: c.tile }]}>
        <RouteIcon color={c.text} size={20} />
      </View>
      <View style={styles.text}>
        <Text style={[Type.body, { color: c.text }]} numberOfLines={1}>
          {vehicleLabel(item.vehicle_id)}
        </Text>
        <Text style={[Type.secondary, { color: c.muted }]} numberOfLines={1}>
          {formatRideWhen(item.start_time)}
          {mins != null ? ` · ${mins} min` : ''}
        </Text>
      </View>
      <Text style={[styles.value, { color: c.text }]} numberOfLines={1}>
        {item.cost != null ? `$${Number(item.cost).toFixed(2)}` : (item.status ?? '—')}
      </Text>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 8 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  value: { fontFamily: FontFamily.display, fontSize: 16 },
});
