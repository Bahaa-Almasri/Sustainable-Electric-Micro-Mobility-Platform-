/** Domain shapes aligned with PostgreSQL / ER model (client-side). */

export type VehicleRow = {
  vehicle_id: string;
  model: string | null;
  type: string | null;
  qr_code: string | null;
  status: string | null;
  last_gps_at: string | null;
};

export type VehicleWithState = {
  state_id: string;
  vehicle_id: string;
  battery_level: number | null;
  lat: number | null;
  lng: number | null;
  status: string | null;
  last_updated: string | null;
  vehicles: VehicleRow | null;
};

export type StationRow = {
  station_id: string;
  name: string;
  lat: number;
  lng: number;
  capacity: number | null;
  available_vehicles: number;
  /** From GET /stations/parking-available — free parking slots (ride / end-ride map). */
  available_parking_spots?: number | null;
};

export type RideRow = {
  ride_id: string;
  user_id: string;
  vehicle_id: string;
  start_time: string | null;
  end_time: string | null;
  start_lat: number | null;
  start_lng: number | null;
  end_lat: number | null;
  end_lng: number | null;
  distance_meters: number | null;
  status: string | null;
  cost: number | null;
};

export type RideRowWithVehicle = RideRow & {
  vehicles: Pick<VehicleRow, 'model' | 'type' | 'qr_code'> | null;
};

export type PackageRow = {
  package_id: string;
  title: string | null;
  description: string | null;
  ride_credits: number | null;
  price: number | null;
  currency: string | null;
  is_active: boolean | null;
};

export type PurchaseRow = {
  purchase_id: string;
  user_id: string;
  package_id: string;
  rides_remaining: number | null;
  payment_id: string | null;
  created_at: string | null;
  ride_packages: Pick<PackageRow, 'title' | 'ride_credits' | 'price' | 'currency'> | null;
};

export type PaymentMethodRow = {
  method_id: string;
  user_id: string;
  provider: string | null;
  last_four: string | null;
  brand: string | null;
  is_default: boolean | null;
  created_at: string | null;
};

export type PaymentRow = {
  payment_id: string;
  user_id: string;
  amount: number | null;
  currency: string | null;
  status: string | null;
  method: string | null;
  created_at: string | null;
};

export type UserRow = {
  user_id: string;
  email: string | null;
  name: string | null;
  phone_number: string | null;
  status: string | null;
};

export type ReservationRow = {
  reservation_id: string;
  user_id: string;
  vehicle_id: string;
  status: string | null;
  created_at: string | null;
  expires_at: string | null;
  vehicles: VehicleRow | null;
};

export type TicketRow = {
  ticket_id: string;
  user_id: string;
  subject: string | null;
  description: string | null;
  status: string | null;
  created_at: string | null;
};
