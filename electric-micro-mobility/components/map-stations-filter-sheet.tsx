import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type MapStationsFilterSheetProps = {
  visible: boolean;
  isDark: boolean;
  accentColor: string;
  showEmptyStations: boolean;
  visibleStationsCount: number;
  totalStationsCount: number;
  onClose: () => void;
  onToggleShowEmptyStations: () => void;
  onReset: () => void;
};

export const MapStationsFilterSheet = memo(function MapStationsFilterSheet({
  visible,
  isDark,
  accentColor,
  showEmptyStations,
  visibleStationsCount,
  totalStationsCount,
  onClose,
  onToggleShowEmptyStations,
  onReset,
}: MapStationsFilterSheetProps) {
  const cardBg = isDark ? '#151718' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(17,24,28,0.1)';
  const muted = isDark ? '#9BA1A6' : '#687076';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}
          onPress={() => {}}
          accessibilityRole="none">
          <View style={styles.headerRow}>
            <View style={styles.titleRow}>
              <Ionicons name="options-outline" size={18} color={accentColor} />
              <ThemedText style={styles.title}>Map Filters</ThemedText>
            </View>
            <Pressable onPress={onClose} style={styles.iconBtn}>
              <Ionicons name="close" size={20} color={muted} />
            </Pressable>
          </View>

          <View style={[styles.infoPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,28,0.05)' }]}>
            <ThemedText style={styles.infoText}>
              Showing {visibleStationsCount} of {totalStationsCount} stations
            </ThemedText>
          </View>

          <Pressable
            onPress={onToggleShowEmptyStations}
            style={({ pressed }) => [
              styles.toggleRow,
              {
                borderColor: border,
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FAFAFB',
                opacity: pressed ? 0.88 : 1,
              },
            ]}>
            <View style={styles.toggleCopy}>
              <ThemedText style={styles.toggleTitle}>Show Empty Stations</ThemedText>
              <ThemedText style={styles.toggleSubtitle}>Include stations with 0 available vehicles</ThemedText>
            </View>
            <View
              style={[
                styles.switchTrack,
                { backgroundColor: showEmptyStations ? accentColor : isDark ? '#2A2E30' : '#D7DBDF' },
              ]}>
              <View style={[styles.switchKnob, showEmptyStations ? styles.switchKnobOn : styles.switchKnobOff]} />
            </View>
          </Pressable>

          <View style={styles.actionsRow}>
            <Pressable
              onPress={onReset}
              style={({ pressed }) => [
                styles.resetBtn,
                { borderColor: border, opacity: pressed ? 0.86 : 1 },
              ]}>
              <ThemedText style={[styles.resetText, { color: accentColor }]}>Reset</ThemedText>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.applyBtn,
                { backgroundColor: accentColor, opacity: pressed ? 0.9 : 1 },
              ]}>
              <ThemedText style={styles.applyText}>Apply</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,12,14,0.45)',
    justifyContent: 'flex-start',
    paddingTop: 88,
    paddingHorizontal: 14,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  infoText: {
    fontSize: 12,
    fontWeight: '700',
  },
  toggleRow: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  toggleSubtitle: {
    fontSize: 12,
    opacity: 0.72,
  },
  switchTrack: {
    width: 46,
    height: 28,
    borderRadius: 999,
    padding: 3,
    justifyContent: 'center',
  },
  switchKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
  },
  switchKnobOn: {
    alignSelf: 'flex-end',
  },
  switchKnobOff: {
    alignSelf: 'flex-start',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  resetBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 11,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetText: {
    fontSize: 14,
    fontWeight: '800',
  },
  applyBtn: {
    flex: 1,
    borderRadius: 11,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
