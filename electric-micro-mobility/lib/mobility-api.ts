import { ApiError, apiFetch } from '@/lib/api-client';
import type {
  PackageRow,
  PaymentMethodRow,
  PaymentRow,
  PurchaseRow,
  ReservationRow,
  RideRow,
  RideRowWithVehicle,
  TicketRow,
  UserRow,
  VehicleWithState,
} from '@/types/entities';

export type { VehicleWithState } from '@/types/entities';

function errMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unknown error';
}

export async function fetchVehiclesForMap(): Promise<{ data: VehicleWithState[]; error: string | null }> {
  try {
    const data = await apiFetch<VehicleWithState[]>('/vehicles/available');
    return { data: Array.isArray(data) ? data : [], error: null };
  } catch (e) {
    return { data: [], error: errMessage(e) };
  }
}

export async function fetchVehicleDetail(vehicleId: string): Promise<{
  data: VehicleWithState | null;
  error: string | null;
}> {
  try {
    const data = await apiFetch<VehicleWithState>(`/vehicles/${vehicleId}`);
    return { data, error: null };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      return { data: null, error: 'Vehicle not found' };
    }
    return { data: null, error: errMessage(e) };
  }
}

export async function fetchUserMe(): Promise<{
  data: UserRow | null;
  error: Error | null;
}> {
  try {
    const data = await apiFetch<UserRow>('/users/me');
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error(errMessage(e)) };
  }
}

export async function fetchRidesForUser(_userId: string): Promise<{
  data: RideRow[] | null;
  error: Error | null;
}> {
  try {
    const data = await apiFetch<RideRow[]>('/rides/me');
    return { data: Array.isArray(data) ? data : [], error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error(errMessage(e)) };
  }
}

export async function fetchReservationsForUser(_userId: string): Promise<{
  data: ReservationRow[] | null;
  error: Error | null;
}> {
  try {
    const data = await apiFetch<ReservationRow[]>('/reservations/me');
    return { data: Array.isArray(data) ? data : [], error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error(errMessage(e)) };
  }
}

export async function fetchSupportTickets(_userId: string): Promise<{
  data: TicketRow[] | null;
  error: Error | null;
}> {
  try {
    const data = await apiFetch<TicketRow[]>('/support/tickets');
    return { data: Array.isArray(data) ? data : [], error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error(errMessage(e)) };
  }
}

export async function createSupportTicket(
  _userId: string,
  subject: string,
  description: string
): Promise<{ error: Error | null }> {
  try {
    await apiFetch('/support/tickets', { method: 'POST', body: JSON.stringify({ subject, description }) });
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(errMessage(e)) };
  }
}

export async function createReservation(
  _userId: string,
  vehicleId: string,
  minutesTtl = 15
): Promise<{ error: Error | null }> {
  try {
    await apiFetch('/reservations/me', {
      method: 'POST',
      body: JSON.stringify({ vehicle_id: vehicleId, minutes_ttl: minutesTtl }),
    });
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(errMessage(e)) };
  }
}

export async function fetchRidePackages(): Promise<{
  data: PackageRow[] | null;
  error: Error | null;
}> {
  try {
    const data = await apiFetch<PackageRow[]>('/wallet/packages');
    return { data: Array.isArray(data) ? data : [], error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error(errMessage(e)) };
  }
}

export async function fetchWalletOverview(): Promise<{
  purchases: PurchaseRow[];
  payment_methods: PaymentMethodRow[];
  recent_payments: PaymentRow[];
  error: Error | null;
}> {
  try {
    const overview = await apiFetch<{
      purchases: PurchaseRow[];
      payment_methods: PaymentMethodRow[];
      recent_payments: PaymentRow[];
    }>('/wallet/overview');
    return {
      purchases: overview.purchases ?? [],
      payment_methods: overview.payment_methods ?? [],
      recent_payments: overview.recent_payments ?? [],
      error: null,
    };
  } catch (e) {
    return {
      purchases: [],
      payment_methods: [],
      recent_payments: [],
      error: e instanceof Error ? e : new Error(errMessage(e)),
    };
  }
}

export async function purchaseRidePackage(_userId: string, pkg: PackageRow): Promise<{ error: string | null }> {
  try {
    await apiFetch('/wallet/purchase', {
      method: 'POST',
      body: JSON.stringify({ package_id: pkg.package_id }),
    });
    return { error: null };
  } catch (e) {
    return { error: errMessage(e) };
  }
}

export async function getActiveRideForUser(_userId: string): Promise<{
  data: RideRowWithVehicle | null;
  error: Error | null;
}> {
  try {
    const data = await apiFetch<RideRowWithVehicle | null>('/rides/me/active');
    return { data: data ?? null, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error(errMessage(e)) };
  }
}

export async function startRide(params: {
  userId: string;
  vehicleId: string;
  startLat: number;
  startLng: number;
}): Promise<{ error: string | null }> {
  try {
    const active = await getActiveRideForUser(params.userId);
    if (active.error) return { error: active.error.message };
    if (active.data) {
      return { error: 'You already have an active ride. End it before starting another.' };
    }
    await apiFetch('/rides/start', {
      method: 'POST',
      body: JSON.stringify({
        vehicle_id: params.vehicleId,
        start_lat: params.startLat,
        start_lng: params.startLng,
      }),
    });
    return { error: null };
  } catch (e) {
    return { error: errMessage(e) };
  }
}

export async function endRide(
  rideId: string,
  vehicleId: string,
  endLat: number,
  endLng: number
): Promise<{ error: string | null }> {
  try {
    await apiFetch('/rides/end', {
      method: 'POST',
      body: JSON.stringify({
        ride_id: rideId,
        end_lat: endLat,
        end_lng: endLng,
      }),
    });
    return { error: null };
  } catch (e) {
    return { error: errMessage(e) };
  }
}
