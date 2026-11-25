import type { RidePricingSnapshot } from '@/types/entities';

type Rate = RidePricingSnapshot;

/** Parse API instants so naive ISO strings are treated as UTC (matches DB storage). */
export function parseRideStartInstant(startIso: string): number {
  const s = startIso.trim();
  const hasExplicitTz = /[zZ]$|[+-]\d{2}:\d{2}$/.test(s);
  return hasExplicitTz ? new Date(s).getTime() : new Date(`${s.replace(/\s*$/, '')}Z`).getTime();
}

export function elapsedSeconds(startIso: string | null | undefined): number {
  if (!startIso) return 0;
  const start = parseRideStartInstant(startIso);
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 1000));
}

export function formatRideDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatClock(startIso: string | null | undefined): string {
  if (!startIso) return '—';
  const start = parseRideStartInstant(startIso);
  if (Number.isNaN(start)) return '—';
  return new Date(start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Same rule as the backend: billed per started minute, at least one.
 * This is an estimate for the UI; the final price comes from the end-ride response.
 */
export function estimateRideCost(rate: Rate | null | undefined, seconds: number): number | null {
  if (!rate) return null;
  return rate.initial_fee + Math.max(1, Math.ceil(seconds / 60)) * rate.price_per_minute;
}
