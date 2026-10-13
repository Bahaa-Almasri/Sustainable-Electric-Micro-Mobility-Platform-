import { Ionicons } from '@expo/vector-icons';
import { useNetworkState } from 'expo-network';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * App-wide banner shown when the device has no internet, so empty or stuck screens
 * read as a connection problem rather than an app bug.
 */
export function OfflineBanner() {
  const { isConnected, isInternetReachable } = useNetworkState();
  const insets = useSafeAreaInsets();
  // Both start undefined until the first reading; only show on a definite "offline".
  const offline = isConnected === false || isInternetReachable === false;
  if (!offline) return null;

  return (
    <View
      style={[styles.banner, { paddingTop: insets.top + 8 }]}
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive">
      <Ionicons name="cloud-offline-outline" size={18} color="#FFFFFF" />
      <Text style={styles.text}>No internet connection. The app will update when you are back online.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#2B2F33',
    zIndex: 1000,
    elevation: 1000,
  },
  text: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
