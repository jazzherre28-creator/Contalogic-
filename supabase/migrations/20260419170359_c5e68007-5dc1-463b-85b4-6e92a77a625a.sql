-- Indicadores económicos (UVT, SMMLV, IPC, TRM, etc.)
CREATE TABLE IF NOT EXISTS public.economic_indicators (
  key text PRIMARY KEY,
  label text NOT NULL,
  value numeric NOT NULL,
  unit text NOT NULL DEFAULT 'COP',
  source text,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.economic_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "indicators_select_all_authenticated"
  ON public.economic_indicators FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "indicators_super_admin_insert"
  ON public.economic_indicators FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "indicators_super_admin_update"
  ON public.economic_indicators FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "indicators_super_admin_delete"
  ON public.economic_indicators FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Trigger updated_at
CREATE TRIGGER touch_economic_indicators
  BEFORE UPDATE ON public.economic_indicators
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed valores oficiales 2026 Colombia
INSERT INTO public.economic_indicators (key, label, value, unit, source, description, updated_at) VALUES
  ('uvt_2026', 'UVT 2026', 49799, 'COP', 'DIAN Resolución', 'Unidad de Valor Tributario vigente para 2026 (Art. 868 ET).', now()),
  ('uvt_2025', 'UVT 2025', 47065, 'COP', 'DIAN Resolución 000193 de 2024', 'Valor histórico UVT 2025 para liquidaciones del año gravable.', now()),
  ('smmlv_2026', 'SMMLV 2026', 1623500, 'COP', 'Decreto Salario Mínimo', 'Salario Mínimo Mensual Legal Vigente.', now()),
  ('aux_transporte_2026', 'Auxilio de Transporte', 200000, 'COP', 'Decreto Gobierno', 'Auxilio mensual obligatorio hasta 2 SMMLV.', now()),
  ('ipc_anual', 'IPC Anual', 5.20, '%', 'DANE', 'Variación anual del Índice de Precios al Consumidor.', now()),
  ('trm', 'TRM', 4150.00, 'COP/USD', 'Banco de la República', 'Tasa Representativa del Mercado USD.', now()),
  ('uvr', 'UVR', 410.50, 'COP', 'Banco de la República', 'Unidad de Valor Real diaria.', now()),
  ('iva_general', 'IVA General', 19, '%', 'Art. 468 ET', 'Tarifa general del IVA en Colombia.', now()),
  ('renta_pj', 'Renta Personas Jurídicas', 35, '%', 'Art. 240 ET', 'Tarifa general del impuesto sobre la renta para sociedades.', now()),
  ('rete_fuente_servicios', 'ReteFuente Servicios', 4, '%', 'Art. 392 ET', 'Retención en la fuente por servicios en general (declarantes).', now())
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  source = EXCLUDED.source,
  description = EXCLUDED.description,
  updated_at = now();