-- Per-vehicle-type pricing (primary source of truth for live rates).
CREATE TABLE IF NOT EXISTS vehicle_pricing (
  id BIGSERIAL PRIMARY KEY,
  vehicle_type TEXT NOT NULL UNIQUE,
  initial_fee DOUBLE PRECISION NOT NULL,
  price_per_minute DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO vehicle_pricing (vehicle_type, initial_fee, price_per_minute)
VALUES
  ('scooter', 0.5, 0.2),
  ('bike', 0.75, 0.25),
  ('car', 1.5, 0.5)
ON CONFLICT (vehicle_type) DO NOTHING;

-- Snapshot at ride start; overwritten at ride end with freshly computed final bill.
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS initial_fee DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS price_per_minute DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS total_cost DOUBLE PRECISION;
