import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/wayfinder/ui';
import { Type } from '@/constants/theme';
import { useWayfinder } from '@/hooks/use-wayfinder';

type MapStationsFilterSheetProps = {
  visible: boolean;
  showEmptyStations: boolean;
  visibleStationsCount: number;
  totalStationsCount: number;
  onClose: () => void;
  onToggleShowEmptyStations: () => void;
  onReset: () => void;
};

export const MapStationsFilterSheet = memo(function MapStationsFilterSheet({
  visible,
  showEmptyStations,
  visibleStationsCount,
  totalStationsCount,
  onClose,
  onToggleShowEmptyStations,
  onReset,
}: MapStationsFilterSheetProps) {
  const { c } = useWayfinder();
  const { bottom } = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: c.backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close map filters" />
        <View style={[styles.sheet, { backgroundColor: c.bg, paddingBottom: bottom + 20 }]}>
          <View style={[styles.grabber, { backgroundColor: c.line }]} />
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={[Type.detailTitle, { color: c.text }]}>Map Filters</Text>
              <Text style={[Type.secondary, { color: c.muted }]}>
                Showing {visibleStationsCount} of {totalStationsCount} stations
              </Text>
            </View>
            <IconButton
              label="Close"
              variant="line"
              onPress={onClose}
              icon={<Ionicons name="close" size={20} color={c.text} />}
            />
          </View>

          <View style={[styles.toggleRow, { borderColor: c.line }]}>
            <View style={styles.headerText}>
              <Text style={[Type.body, { color: c.text }]}>Show Empty Stations</Text>
              <Text style={[Type.secondary, { color: c.muted }]}>Include stations with 0 available vehicles</Text>
            </View>
            <Switch
              accessibilityLabel="Show Empty Stations"
              value={showEmptyStations}
              onValueChange={onToggleShowEmptyStations}
              trackColor={{ false: c.muted, true: c.accent }}
              thumbColor={c.surface}
              ios_backgroundColor={c.muted}
            />
          </View>

          <View style={styles.actions}>
            <Button label="Reset" variant="secondary" onPress={onReset} height={50} radius={16} style={styles.reset} />
            <Button label="Apply" onPress={onClose} height={50} radius={16} style={styles.apply} />
          </View>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 10, gap: 16 },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1, minWidth: 0 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1 },
  actions: { flexDirection: 'row', gap: 8 },
  reset: { flex: 1 },
  apply: { flex: 2 },
});
