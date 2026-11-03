import { useEffect, useRef, useState } from 'react';

import { distanceMetersBetween } from '@/lib/geo-distance';

type Point = { latitude: number; longitude: number };

/** Ignore smaller moves: GPS drifts a few meters even when the rider is standing still. */
const MIN_STEP_METERS = 10;

/**
 * Adds up the rider's location updates during a ride. On-device only: it restarts if the app
 * reloads, and the backend does not store it yet (see docs/design/FEATURE_AGENDA.md).
 */
export function useRideDistance(rideId: string | undefined, location: Point | null): number | null {
  const [meters, setMeters] = useState(0);
  const lastRef = useRef<Point | null>(null);
  const rideRef = useRef(rideId);

  useEffect(() => {
    if (rideRef.current !== rideId) {
      rideRef.current = rideId;
      lastRef.current = null;
      setMeters(0);
    }
    if (!location) return;
    const last = lastRef.current;
    if (!last) {
      lastRef.current = location;
      return;
    }
    const step = distanceMetersBetween(last, location);
    if (step < MIN_STEP_METERS) return;
    lastRef.current = location;
    setMeters((m) => m + step);
  }, [rideId, location]);

  return location ? meters : null;
}
