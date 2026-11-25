import { Ionicons } from '@expo/vector-icons';
import { CameraView, type BarcodeScanningResult, useCameraPermissions } from 'expo-camera';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ToastHost } from '@/components/toast-host';
import { FontFamily } from '@/constants/theme';
import { useWayfinder } from '@/hooks/use-wayfinder';

type ScanToRideModalProps = {
  visible: boolean;
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
  /** "Enter the code instead": for a scratched, dirty or glaring QR sticker, or no camera. */
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
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
    setManualOpen(false);
    setManualCode('');
    setManualError(null);
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

  const onManualSubmit = useCallback(async () => {
    if (busy || scanLocked) return;
    const code = normalizePayload(manualCode);
    if (!code) {
      setManualError('Type the code printed under the QR sticker.');
      return;
    }
    if (!SKIP_QR_MATCH_IN_DEV && normalizedExpected.length > 0 && !normalizedExpected.includes(code)) {
      setManualError('That code does not match the selected vehicle. Check the sticker and try again.');
      return;
    }
    setManualError(null);
    await runConfirmed();
  }, [busy, manualCode, normalizedExpected, runConfirmed, scanLocked]);

  /** The OS only asks once; after "Don't allow" the user has to enable the camera in Settings. */
  const canOpenSettings = Platform.OS !== 'web' && permissionDenied;

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

  const { c } = useWayfinder();
  const muted = c.muted;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: c.bg }]}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>Scan to Ride</ThemedText>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={c.text} />
            </Pressable>
          </View>

          <ThemedText style={styles.subtitle}>
            Point your rear camera at the vehicle QR code to start the ride.
            {SKIP_QR_MATCH_IN_DEV ? ' Development build: any QR scan starts the ride.' : ''}
          </ThemedText>

          {scanError ? (
            <View style={[styles.scanErrorBanner, { backgroundColor: c.accentSoft }]}>
              <ThemedText style={[styles.scanErrorText, { color: c.accentText }]}>{scanError}</ThemedText>
            </View>
          ) : null}

          <View style={[styles.cameraWrap, manualOpen && styles.compact, { borderColor: c.line }]}>
            {cameraReady ? (
              <CameraView
                style={[styles.camera, manualOpen && styles.compactCamera]}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={onBarcodeScanned}
                onMountError={(event) => {
                  setFatalError(getReadableCameraError(event.message));
                }}
              />
            ) : (
              <View style={[styles.placeholder, manualOpen && styles.compact]}>
                <Ionicons name="qr-code-outline" size={34} color={c.text} />
                <ThemedText style={styles.placeholderText}>
                  {fatalError ??
                    (permission?.granted ? 'Preparing camera...' : 'Requesting camera permission...')}
                </ThemedText>
                {canOpenSettings ? (
                  <>
                    <ThemedText style={[styles.placeholderHint, { color: muted }]}>
                      Turn on Camera for this app in your phone settings, then come back.
                    </ThemedText>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void Linking.openSettings()}
                      style={({ pressed }) => [styles.settingsBtn, { backgroundColor: c.inverse, opacity: pressed ? 0.86 : 1 }]}>
                      <Ionicons name="settings-outline" size={16} color={c.inverseText} />
                      <ThemedText style={[styles.settingsText, { color: c.inverseText }]}>Open Settings</ThemedText>
                    </Pressable>
                  </>
                ) : null}
              </View>
            )}
          </View>

          {manualOpen ? (
            <View style={[styles.manualBox, { borderColor: c.line }]}>
              <ThemedText style={[styles.manualLabel, { color: muted }]}>VEHICLE CODE</ThemedText>
              <View style={styles.manualRow}>
                <TextInput
                  value={manualCode}
                  onChangeText={(t) => {
                    setManualCode(t);
                    setManualError(null);
                  }}
                  placeholder="Code under the QR sticker"
                  placeholderTextColor={muted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoFocus
                  returnKeyType="go"
                  onSubmitEditing={() => void onManualSubmit()}
                  accessibilityLabel="Vehicle code"
                  style={[styles.manualInput, { color: c.text, borderBottomColor: c.text }]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Unlock with code"
                  onPress={() => void onManualSubmit()}
                  disabled={busy}
                  style={({ pressed }) => [styles.manualGo, { backgroundColor: c.accent, opacity: pressed || busy ? 0.85 : 1 }]}>
                  <ThemedText style={[styles.primaryText, { color: c.onAccent }]}>{busy ? '...' : 'Unlock'}</ThemedText>
                </Pressable>
              </View>
              {manualError ? (
                <ThemedText style={[styles.manualError, { color: c.accentText }]}>{manualError}</ThemedText>
              ) : null}
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => setManualOpen(true)}
              hitSlop={6}
              style={styles.manualLink}>
              <ThemedText style={[styles.manualLinkText, { color: c.accentText }]}>
                Can&apos;t scan? Enter the code instead
              </ThemedText>
            </Pressable>
          )}

          {SKIP_QR_MATCH_IN_DEV && cameraReady ? (
            <Pressable
              style={({ pressed }) => [
                styles.devSkipBtn,
                {
                  borderColor: c.line,
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
                  borderColor: c.text,
                  opacity: pressed ? 0.86 : 1,
                },
              ]}
              onPress={onClose}>
              <ThemedText style={styles.secondaryText}>Cancel</ThemedText>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: c.accent, opacity: pressed || busy ? 0.9 : 1 },
              ]}
              onPress={onPrimaryPress}
              disabled={busy}>
              <ThemedText style={[styles.primaryText, { color: c.onAccent }]}>
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
        <ToastHost />
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
    fontFamily: FontFamily.display,
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
    fontFamily: FontFamily.bold,
    textAlign: 'center',
  },
  cameraWrap: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
    minHeight: 300,
  },
  /** Smaller camera while the code field is open, so the card fits above the keyboard. */
  compact: {
    minHeight: 170,
  },
  compactCamera: {
    height: 190,
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
    fontFamily: FontFamily.semibold,
  },
  placeholderHint: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
  },
  settingsBtn: {
    marginTop: 4,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsText: {
    fontSize: 14,
    fontFamily: FontFamily.bold,
  },
  manualLink: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  manualLinkText: {
    fontSize: 14,
    fontFamily: FontFamily.bold,
  },
  manualBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  manualLabel: {
    fontSize: 12,
    letterSpacing: 1.3,
    fontFamily: FontFamily.semibold,
  },
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  manualInput: {
    flex: 1,
    minHeight: 44,
    fontSize: 17,
    fontFamily: FontFamily.medium,
    borderBottomWidth: 1.5,
    paddingHorizontal: 0,
  },
  manualGo: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualError: {
    fontSize: 13,
    fontFamily: FontFamily.semibold,
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
    fontFamily: FontFamily.bold,
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
    fontFamily: FontFamily.bold,
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontSize: 14,
    fontFamily: FontFamily.display,
  },
  webHint: {
    opacity: 0.62,
    fontSize: 12,
    lineHeight: 16,
  },
});
