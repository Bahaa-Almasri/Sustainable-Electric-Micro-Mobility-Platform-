import { memo, useEffect, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { elapsedSeconds, estimateRideCost, formatRideDuration } from '@/lib/ride-time';
import type { RidePricingSnapshot } from '@/types/entities';

/** Re-renders the calling component once a second while it is mounted. */
function useSecondTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
}

type RideDurationTextProps = { startTime: string | null | undefined; style?: StyleProp<TextStyle> };

/**
 * The ride clock (mm:ss). It owns the one-second tick, so only this text re-renders
 * every second, not the whole ride card around it (map, timeline, images, buttons).
 */
export const RideDurationText = memo(function RideDurationText({ startTime, style }: RideDurationTextProps) {
  useSecondTick();
  const label = formatRideDuration(elapsedSeconds(startTime));
  return (
    <Text style={style} accessibilityLabel={`Ride duration ${label}`}>
      {label}
    </Text>
  );
});

type RideCostTextProps = {
  startTime: string | null | undefined;
  rate: RidePricingSnapshot | null;
  style?: StyleProp<TextStyle>;
};

/** Cost so far, same rule as the backend. Ticks on its own like `RideDurationText`. */
export const RideCostText = memo(function RideCostText({ startTime, rate, style }: RideCostTextProps) {
  useSecondTick();
  const cost = estimateRideCost(rate, elapsedSeconds(startTime));
  return <Text style={style}>{cost == null ? '—' : `$${cost.toFixed(2)}`}</Text>;
});
