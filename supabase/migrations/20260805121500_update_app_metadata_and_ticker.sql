-- Update app metadata and ensure daily-refresh-ready economic ticker values

-- 1) Common trigger function to refresh updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2) Add updated_at to key tables if missing
ALTER TABLE IF EXISTS public.financial_records
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS public.ocr_documents
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS public.notifications
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS public.tax_deadlines
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS public.tax_dictionary
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS public.user_reminders
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS public.user_roles
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS public.economic_indicators
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 3) Add automatic updated_at trigger to relevant tables
DROP TRIGGER IF EXISTS touch_financial_records ON public.financial_records;
CREATE TRIGGER touch_financial_records
  BEFORE UPDATE ON public.financial_records
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_ocr_documents ON public.ocr_documents;
CREATE TRIGGER touch_ocr_documents
  BEFORE UPDATE ON public.ocr_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_notifications ON public.notifications;
CREATE TRIGGER touch_notifications
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_tax_deadlines ON public.tax_deadlines;
CREATE TRIGGER touch_tax_deadlines
  BEFORE UPDATE ON public.tax_deadlines
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_tax_dictionary ON public.tax_dictionary;
CREATE TRIGGER touch_tax_dictionary
  BEFORE UPDATE ON public.tax_dictionary
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_user_reminders ON public.user_reminders;
CREATE TRIGGER touch_user_reminders
  BEFORE UPDATE ON public.user_reminders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_user_roles ON public.user_roles;
CREATE TRIGGER touch_user_roles
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_economic_indicators ON public.economic_indicators;
CREATE TRIGGER touch_economic_indicators
  BEFORE UPDATE ON public.economic_indicators
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_profiles ON public.profiles;
CREATE TRIGGER touch_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) Update ticker values for economic_indicators now
UPDATE public.economic_indicators
SET value = CASE key
    WHEN 'uvt_2026' THEN 49799
    WHEN 'uvt_2025' THEN 47065
    WHEN 'smmlv_2026' THEN 1623500
    WHEN 'aux_transporte_2026' THEN 200000
    WHEN 'ipc_anual' THEN 5.20
    WHEN 'trm' THEN 4150.00
    WHEN 'uvr' THEN 410.50
    WHEN 'iva_general' THEN 19
    WHEN 'renta_pj' THEN 35
    WHEN 'rete_fuente_servicios' THEN 4
    ELSE value
  END,
  updated_at = now()
WHERE key IN (
  'uvt_2026',
  'uvt_2025',
  'smmlv_2026',
  'aux_transporte_2026',
  'ipc_anual',
  'trm',
  'uvr',
  'iva_general',
  'renta_pj',
  'rete_fuente_servicios'
);

-- 5) Daily refresh note: programar esta SQL como un job diario si deseas que la cinta se actualice automáticamente cada mañana.
-- Ejemplo de cron: ejecutar este mismo UPDATE sobre economic_indicators a las 06:00 cada día.
