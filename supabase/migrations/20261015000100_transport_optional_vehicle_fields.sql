ALTER TABLE public.transport_trips
  ALTER COLUMN vehicle_plate DROP NOT NULL,
  ALTER COLUMN capacity_kg DROP NOT NULL;

ALTER TABLE public.transport_trips
  DROP CONSTRAINT transport_trips_vehicle_plate_check,
  DROP CONSTRAINT transport_trips_capacity_kg_check,
  ADD CONSTRAINT transport_trips_vehicle_plate_check
    CHECK (vehicle_plate IS NULL OR length(btrim(vehicle_plate)) > 0),
  ADD CONSTRAINT transport_trips_capacity_kg_check
    CHECK (capacity_kg IS NULL OR capacity_kg > 0);
