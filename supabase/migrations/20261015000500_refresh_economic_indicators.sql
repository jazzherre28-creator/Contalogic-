ALTER TABLE public.economic_indicators
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS description text;

UPDATE public.economic_indicators AS indicator
SET key = CASE indicator.key
    WHEN 'uvt_2026' THEN 'uvt'
    WHEN 'smmlv_2026' THEN 'smlv'
    ELSE indicator.key
  END
WHERE indicator.key IN ('uvt_2026', 'smmlv_2026')
  AND NOT EXISTS (
    SELECT 1
    FROM public.economic_indicators AS existing
    WHERE existing.key = CASE indicator.key
      WHEN 'uvt_2026' THEN 'uvt'
      WHEN 'smmlv_2026' THEN 'smlv'
    END
  );

WITH current_indicators (key, label, value, unit, source, description) AS (
  VALUES
    (
      'uvt',
      'UVT 2026',
      52374,
      'COP',
      'DIAN · Resolución 000227 de 2025',
      'Unidad de Valor Tributario vigente para 2026.'
    ),
    (
      'smlv',
      'SMMLV 2026',
      1750905,
      'COP',
      'Gobierno de Colombia · Ministerio del Trabajo',
      'Salario mínimo mensual legal vigente para 2026, sin auxilio de transporte.'
    ),
    (
      'aux_transporte_2026',
      'Auxilio de transporte 2026',
      249095,
      'COP',
      'Gobierno de Colombia · Ministerio del Trabajo',
      'Auxilio mensual de transporte para 2026, sujeto a las condiciones legales de reconocimiento.'
    ),
    (
      'iva_general',
      'IVA general',
      19,
      '%',
      'Estatuto Tributario · Artículo 468',
      'Tarifa general del IVA; existen bienes y servicios excluidos, exentos y tarifas especiales.'
    ),
    (
      'renta_pj',
      'Renta sociedades',
      35,
      '%',
      'Estatuto Tributario · Artículo 240',
      'Tarifa general de renta para personas jurídicas; pueden aplicar tarifas y reglas especiales.'
    )
)
INSERT INTO public.economic_indicators (key, label, value, unit, source, description, updated_at)
SELECT
  current_indicators.key,
  current_indicators.label,
  current_indicators.value,
  current_indicators.unit,
  current_indicators.source,
  current_indicators.description,
  now()
FROM current_indicators
WHERE NOT EXISTS (
  SELECT 1
  FROM public.economic_indicators AS existing
  WHERE existing.key = current_indicators.key
);

UPDATE public.economic_indicators
SET
  label = CASE key
    WHEN 'uvt' THEN 'UVT 2026'
    WHEN 'smlv' THEN 'SMMLV 2026'
    WHEN 'aux_transporte_2026' THEN 'Auxilio de transporte 2026'
    WHEN 'iva_general' THEN 'IVA general'
    WHEN 'renta_pj' THEN 'Renta sociedades'
  END,
  value = CASE key
    WHEN 'uvt' THEN 52374
    WHEN 'smlv' THEN 1750905
    WHEN 'aux_transporte_2026' THEN 249095
    WHEN 'iva_general' THEN 19
    WHEN 'renta_pj' THEN 35
  END,
  unit = CASE WHEN key IN ('iva_general', 'renta_pj') THEN '%' ELSE 'COP' END,
  source = CASE key
    WHEN 'uvt' THEN 'DIAN · Resolución 000227 de 2025'
    WHEN 'smlv' THEN 'Gobierno de Colombia · Ministerio del Trabajo'
    WHEN 'aux_transporte_2026' THEN 'Gobierno de Colombia · Ministerio del Trabajo'
    WHEN 'iva_general' THEN 'Estatuto Tributario · Artículo 468'
    WHEN 'renta_pj' THEN 'Estatuto Tributario · Artículo 240'
  END,
  description = CASE key
    WHEN 'uvt' THEN 'Unidad de Valor Tributario vigente para 2026.'
    WHEN 'smlv' THEN 'Salario mínimo mensual legal vigente para 2026, sin auxilio de transporte.'
    WHEN 'aux_transporte_2026' THEN 'Auxilio mensual de transporte para 2026, sujeto a las condiciones legales de reconocimiento.'
    WHEN 'iva_general' THEN 'Tarifa general del IVA; existen bienes y servicios excluidos, exentos y tarifas especiales.'
    WHEN 'renta_pj' THEN 'Tarifa general de renta para personas jurídicas; pueden aplicar tarifas y reglas especiales.'
  END,
  updated_at = now()
WHERE key IN ('uvt', 'smlv', 'aux_transporte_2026', 'iva_general', 'renta_pj');
