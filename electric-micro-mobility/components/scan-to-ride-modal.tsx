import { Ionicons } from '@expo/vector-icons';
import { CameraView, type BarcodeScanningResult, useCameraPermissions } from 'expo-camera';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type ScanToRideModalProps = {
  visible: boolean;
  accentColor: string;
  isDark: boolean;
  expectedPayloads: string[];
  busy: boolean;
  onClose: () => void;
  onScanConfirmed: () => Promise<void> | void;
};

function normalizePayload(raw: string): string {
  return raw.trim().toLowerCase();
}

function getReadableCameraError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('permission')) return 'Camera access is required to scan the QR code.';
  if (m.includes('facing') || m.includes('back')) return 'Back camera is unavailable on this device.';
  return 'Unable to open the camera right now.';
}

/** Temporary: relax QR checks in dev so ride start can be tested without matching payloads. */
const SKIP_QR_MATCH_IN_DEV = typeof __DEV__ !== 'undefined' && __DEV__;

export const ScanToRideModal = memo(function ScanToRideModal({
  visible,
  accentColor,
  isDark,
  expectedPayloads,
  busy,
  onClose,
  onScanConfirmed,
}: ScanToRideModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);
  const [scanLocked, setScanLocked] = useState(false);
  /** Blocks camera (permission, no hardware, mount failure). */
  const [fatalError, setFatalError] = useState<string | null>(null);
  /** Wrong QR, etc. — camera can stay open. */
  const [scanError, setScanError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const normalizedExpected = useMemo(
    () => Array.from(new Set(expectedPayloads.map(normalizePayload))).filter(Boolean),
    [expectedPayloads]
  );

  const checkAvailability = useCallback(async () => {
    try {
      const available = await CameraView.isAvailableAsync();
      setCameraAvailable(available);
      if (!available) {
        setFatalError('No camera was found on this device.');
      }
    } catch {
      setCameraAvailable(false);
      setFatalError('Camera is not available on this platform/browser.');
    }
  }, []);

  const askPermission = useCallback(async () => {
    const res = await requestPermission();
    if (!res.granted) {
      setPermissionDenied(true);
      setFatalError('Camera access is needed to scan the vehicle QR code.');
      return false;
    }
    setPermissionDenied(false);
    setFatalError(null);
    return true;
  }, [requestPermission]);

  useEffect(() => {
    if (!visible) return;
    setScanLocked(false);
    setFatalError(null);
    setScanError(null);
    setPermissionDenied(false);
    void checkAvailability();
  }, [checkAvailability, visible]);

  useEffect(() => {
    if (!visible) return;
    if (permission?.granted) return;
    void askPermission();
  }, [askPermission, permission?.granted, visible]);

  const runConfirmed = useCallback(async () => {
    if (busy) return;
    setScanLocked(true);
    try {
      await onScanConfirmed();
    } finally {
      setScanLocked(false);
    }
  }, [busy, onScanConfirmed]);

  const onBarcodeScanned = useCallback(
    async (result: BarcodeScanningResult) => {
      if (scanLocked || busy) return;
      setScanLocked(true);
      setScanError(null);
      const scanned = normalizePayload(result.data ?? '');

      if (SKIP_QR_MATCH_IN_DEV) {
        await onScanConfirmed();
        setScanLocked(false);
        return;
      }

      if (normalizedExpected.length > 0 && !normalizedExpected.includes(scanned)) {
        setScanError('This QR code does not match the selected vehicle. Please try again.');
        setScanLocked(false);
        return;
      }
      await onScanConfirmed();
      setScanLocked(false);
    },
    [busy, normalizedExpected, onScanConfirmed, scanLocked]
  );

  const onPrimaryPress = useCallback(async () => {
    if (permissionDenied || !permission?.granted) {
      setFatalError(null);
      await askPermission();
      return;
    }
    setScanError(null);
    setScanLocked(false);
  }, [askPermission, permission?.granted, permissionDenied]);

  const cameraReady =
    visible &&
    cameraAvailable === true &&
    permission?.granted === true &&
    !permissionDenied &&
    !fatalError;

  const muted = isDark ? '#9BA1A6' : '#687076';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: isDark ? '#11181C' : '#FFFFFF' }]}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>Scan to Ride</ThemedText>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={isDark ? '#ECEDEE' : '#11181C'} />
            </Pressable>
          </View>

          <ThemedText style={styles.subtitle}>
            Point your rear camera at the vehicle QR code to start the ride.
            {SKIP_QR_MATCH_IN_DEV ? ' Development build: any QR scan starts the ride.' : ''}
          </ThemedText>

          {scanError ? (
            <View style={[styles.scanErrorBanner, { backgroundColor: isDark ? 'rgba(217,4,41,0.2)' : 'rgba(217,4,41,0.1)' }]}>
              <ThemedText style={[styles.scanErrorText, { color: '#D90429' }]}>{scanError}</ThemedText>
            </View>
          ) : null}

          <View style={[styles.cameraWrap, { borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(17,24,28,0.12)' }]}>
            {cameraReady ? (
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={onBarcodeScanned}
                onMountError={(event) => {
                  setFatalError(getReadableCameraError(event.message));
                }}
              />
            ) : (
              <View style={styles.placeholder}>
                <Ionicons name="qr-code-outline" size={34} color={isDark ? '#ECEDEE' : '#11181C'} />
                <ThemedText style={styles.placeholderText}>
                  {fatalError ??
                    (permission?.granted ? 'Preparing camera...' : 'Requesting camera permission...')}
                </ThemedText>
              </View>
            )}
          </View>

          {SKIP_QR_MATCH_IN_DEV && cameraReady ? (
            <Pressable
              style={({ pressed }) => [
                styles.devSkipBtn,
                {
                  borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(17,24,28,0.15)',
                  opacity: pressed || busy ? 0.85 : 1,
                },
              ]}
              onPress={() => void runConfirmed()}
              disabled={busy}>
              <ThemedText style={[styles.devSkipText, { color: muted }]}>
                Start ride without scan (dev testing)
              </ThemedText>
            </Pressable>
          ) : null}

          <View style={styles.actionsRow}>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryBtn,
                {
                  borderColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(17,24,28,0.2)',
                  opacity: pressed ? 0.86 : 1,
                },
              ]}
              onPress={onClose}>
              <ThemedText style={styles.secondaryText}>Cancel</ThemedText>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: accentColor, opacity: pressed || busy ? 0.9 : 1 },
              ]}
              onPress={onPrimaryPress}
              disabled={busy}>
              <ThemedText style={styles.primaryText}>
                {permissionDenied || !permission?.granted
                  ? 'Try again'
                  : 'Clear & scan again'}
              </ThemedText>
            </Pressable>
          </View>

          {Platform.OS === 'web' ? (
            <ThemedText style={styles.webHint}>
              If camera access fails in web, use HTTPS and allow browser camera permissions.
            </ThemedText>
          ) : null}
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8,12,14,0.58)',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    opacity: 0.76,
    fontSize: 13,
    lineHeight: 18,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanErrorBanner: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  scanErrorText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  cameraWrap: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
    minHeight: 300,
  },
  camera: {
    width: '100%',
    height: 320,
  },
  placeholder: {
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
  },
  placeholderText: {
    textAlign: 'center',
    opacity: 0.8,
    fontWeight: '600',
  },
  devSkipBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  devSkipText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1.2,
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '700',
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  webHint: {
    opacity: 0.62,
    fontSize: 12,
    lineHeight: 16,
  },
});
