/** Haversine distance in meters between two WGS84 points. */
export function distanceMetersBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistanceAway(meters: number | null): string {
  if (meters == null || Number.isNaN(meters)) return 'Nearby you';
  if (meters < 1000) return `${Math.round(meters)} m away from you`;
  const km = meters / 1000;
  const rounded = km >= 10 ? Math.round(km) : Math.round(km * 10) / 10;
  return `${rounded} km away from you`;
}
