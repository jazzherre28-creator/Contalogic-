-- Actualiza los valores de la cinta superior y marca la fecha de actualización más reciente.
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
