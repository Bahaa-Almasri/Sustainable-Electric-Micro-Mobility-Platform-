-- 1. Add 'car' to enum (only if it doesn't already exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'vehicle_type'
        AND e.enumlabel = 'car'
    ) THEN
        ALTER TYPE vehicle_type ADD VALUE 'car';
    END IF;
END$$;

-- 2. Update existing rows: bike → car
UPDATE vehicles
SET type = 'car'
WHERE type = 'bike';