ALTER TABLE public.financial_records
  ADD COLUMN IF NOT EXISTS source text;

UPDATE public.financial_records
SET source = 'legacy'
WHERE source IS NULL;

ALTER TABLE public.financial_records
  ALTER COLUMN source SET DEFAULT 'manual',
  ALTER COLUMN source SET NOT NULL;

ALTER TABLE public.financial_records
  ADD CONSTRAINT financial_records_source_check
  CHECK (source IN ('manual', 'ocr', 'legacy'));
