import { Redirect, type Href } from 'expo-router';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { LoaderAccent } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

export default function Index() {
  const { user, loading, configured } = useAuth();

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={LoaderAccent} />
      </ThemedView>
    );
  }

  if (!configured) {
    return <Redirect href={'/sign-in' as Href} />;
  }

  if (user) {
    return <Redirect href={'/(tabs)/wallet' as Href} />;
  }

  return <Redirect href={'/sign-in' as Href} />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
