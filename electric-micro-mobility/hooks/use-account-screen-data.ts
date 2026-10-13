import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchAccountSummary } from '@/lib/mobility-api';
import type { PurchaseRow, ReservationRow, RideRow, UserRow } from '@/types/entities';

export function useAccountScreenData(userId: string | undefined) {
  const [profile, setProfile] = useState<UserRow | null>(null);
  const [rides, setRides] = useState<RideRow[]>([]);
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const screenFocusRef = useRef(false);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      if (!userId) {
        setProfile(null);
        setRides([]);
        setReservations([]);
        setPurchases([]);
        setWalletError(null);
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const { data: summary, error } = await fetchAccountSummary();

        setProfile(summary?.profile ?? null);
        setRides(summary?.rides ?? []);
        setReservations(summary?.reservations ?? []);

        if (summary?.wallet) {
          setPurchases(summary.wallet.purchases ?? []);
          setWalletError(null);
        } else {
          setPurchases([]);
          setWalletError(summary?.errors.wallet ?? error?.message ?? 'Wallet unavailable');
        }
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setRides([]);
      setReservations([]);
      setPurchases([]);
      setWalletError(null);
      setLoading(false);
    }
  }, [userId]);

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

  return {
    profile,
    rides,
    reservations,
    purchases,
    walletError,
    loading,
    refreshing,
    load,
    onRefresh,
  };
}
