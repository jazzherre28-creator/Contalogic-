CREATE TABLE public.transport_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_date date NOT NULL DEFAULT CURRENT_DATE,
  origin text NOT NULL CHECK (length(btrim(origin)) > 0),
  destination text NOT NULL CHECK (length(btrim(destination)) > 0),
  vehicle_plate text NOT NULL CHECK (length(btrim(vehicle_plate)) > 0),
  driver_name text,
  loaded_km numeric NOT NULL DEFAULT 0 CHECK (loaded_km >= 0),
  empty_km numeric NOT NULL DEFAULT 0 CHECK (empty_km >= 0),
  capacity_kg numeric NOT NULL CHECK (capacity_kg > 0),
  fuel_liters numeric NOT NULL DEFAULT 0 CHECK (fuel_liters >= 0),
  cargo_items jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(cargo_items) = 'array'),
  freight_cop numeric NOT NULL DEFAULT 0 CHECK (freight_cop >= 0),
  surcharge_cop numeric NOT NULL DEFAULT 0 CHECK (surcharge_cop >= 0),
  customer_advance_cop numeric NOT NULL DEFAULT 0 CHECK (customer_advance_cop >= 0),
  customer_final_payment_cop numeric NOT NULL DEFAULT 0 CHECK (customer_final_payment_cop >= 0),
  other_customer_collection_cop numeric NOT NULL DEFAULT 0 CHECK (other_customer_collection_cop >= 0),
  customer_withheld_cop numeric NOT NULL DEFAULT 0 CHECK (customer_withheld_cop >= 0),
  driver_advance_cop numeric NOT NULL DEFAULT 0 CHECK (driver_advance_cop >= 0),
  driver_cash_returned_cop numeric NOT NULL DEFAULT 0 CHECK (driver_cash_returned_cop >= 0),
  expenses jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(expenses) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transport_trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transport_trips_owner_sector"
  ON public.transport_trips
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.sector = 'transporte'
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.sector = 'transporte'
    )
  );

CREATE INDEX transport_trips_owner_date_idx
  ON public.transport_trips (user_id, trip_date DESC, created_at DESC);

COMMENT ON TABLE public.transport_trips IS
  'Control operativo-financiero independiente de viajes y carga terrestre para perfiles del sector transporte.';
