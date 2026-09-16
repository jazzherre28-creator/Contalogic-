-- 1. Add NIT to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nit TEXT,
  ADD COLUMN IF NOT EXISTS nit_last_digit INTEGER;

-- Auto-compute last digit
CREATE OR REPLACE FUNCTION public.compute_nit_last_digit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.nit IS NOT NULL AND length(regexp_replace(NEW.nit, '[^0-9]', '', 'g')) > 0 THEN
    NEW.nit_last_digit := (regexp_replace(NEW.nit, '[^0-9]', '', 'g'))::TEXT;
    NEW.nit_last_digit := substring(regexp_replace(NEW.nit, '[^0-9]', '', 'g') from '([0-9])$')::INTEGER;
  ELSE
    NEW.nit_last_digit := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_nit_digit ON public.profiles;
CREATE TRIGGER profiles_nit_digit
BEFORE INSERT OR UPDATE OF nit ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.compute_nit_last_digit();

-- 2. tax_deadlines
CREATE TABLE IF NOT EXISTS public.tax_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'ambas',
  sector TEXT NOT NULL DEFAULT 'todos',
  period TEXT NOT NULL,
  due_date DATE NOT NULL,
  nit_last_digit INTEGER,
  description TEXT,
  estatuto_article TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deadlines_select_authenticated" ON public.tax_deadlines
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "deadlines_super_admin_insert" ON public.tax_deadlines
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "deadlines_super_admin_update" ON public.tax_deadlines
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "deadlines_super_admin_delete" ON public.tax_deadlines
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_deadlines_due ON public.tax_deadlines(due_date);
CREATE INDEX IF NOT EXISTS idx_deadlines_sector ON public.tax_deadlines(sector);

-- 3. tax_dictionary
CREATE TABLE IF NOT EXISTS public.tax_dictionary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  estatuto_article TEXT,
  sectors TEXT[] NOT NULL DEFAULT ARRAY['todos'],
  entity_types TEXT[] NOT NULL DEFAULT ARRAY['ambas'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_dictionary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dict_select_authenticated" ON public.tax_dictionary
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "dict_super_admin_insert" ON public.tax_dictionary
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "dict_super_admin_update" ON public.tax_dictionary
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "dict_super_admin_delete" ON public.tax_dictionary
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_dict_term ON public.tax_dictionary(term);

-- 4. user_reminders
CREATE TABLE IF NOT EXISTS public.user_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  deadline_id UUID NOT NULL REFERENCES public.tax_deadlines(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, deadline_id)
);

ALTER TABLE public.user_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rem_select_own" ON public.user_reminders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "rem_insert_own" ON public.user_reminders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "rem_update_own" ON public.user_reminders
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "rem_delete_own" ON public.user_reminders
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "rem_super_admin_view" ON public.user_reminders
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'super_admin'));

-- 5. Seed tax_dictionary
INSERT INTO public.tax_dictionary (term, definition, estatuto_article, sectors, entity_types) VALUES
('UVT', 'Unidad de Valor Tributario. Para 2026: $49.799 COP. Es la unidad de medida usada para fijar topes, sanciones y umbrales del Estatuto Tributario.', 'Art. 868 ET', ARRAY['todos'], ARRAY['ambas']),
('RST', 'Régimen Simple de Tributación. Régimen opcional para personas naturales y jurídicas con ingresos brutos hasta 100.000 UVT que sustituye Renta, ICA y consolida aportes.', 'Art. 903-916 ET', ARRAY['todos'], ARRAY['ambas']),
('Renta Presuntiva', 'Base mínima sobre la cual se calcula el impuesto de renta, equivalente al 0% del patrimonio líquido del año anterior (eliminada desde 2021 para PN, vigente solo para algunos casos).', 'Art. 188 ET', ARRAY['todos'], ARRAY['ambas']),
('IVA', 'Impuesto sobre las Ventas. Tarifa general del 19%, tarifas especiales del 5% y exentos. Se declara bimestral o cuatrimestralmente según ingresos.', 'Art. 420-512 ET', ARRAY['todos'], ARRAY['ambas']),
('ReteFuente', 'Mecanismo de recaudo anticipado del impuesto de renta. Tarifas variables según concepto (servicios, compras, honorarios).', 'Art. 365-401 ET', ARRAY['todos'], ARRAY['ambas']),
('Costos y Gastos Art. 107', 'Para que un gasto sea deducible debe tener relación de causalidad, necesidad y proporcionalidad con la actividad productora de renta.', 'Art. 107 ET', ARRAY['todos'], ARRAY['ambas']),
('Depreciación', 'Reconocimiento del desgaste de activos fijos. Tarifas máximas: vehículos 20%, maquinaria 10%, edificios 2.22% anual.', 'Art. 137-141 ET', ARRAY['todos'], ARRAY['ambas']),
('Salario Mínimo 2026', 'SMMLV 2026: $1.623.500 COP. Auxilio de transporte: $200.000 COP. Base para cálculos laborales y aportes parafiscales.', 'Decreto 1572/2025', ARRAY['todos'], ARRAY['ambas']),
('ACPM Deducible', 'El combustible (ACPM) usado en la actividad de transporte es 100% deducible siempre que se soporte con factura electrónica y se relacione con la operación.', 'Art. 107 + 771-2 ET', ARRAY['transporte'], ARRAY['ambas']),
('Mantenimiento Vehicular', 'Gastos de mantenimiento, repuestos y reparación de la flota son deducibles al 100% si se prueban con factura y constituyen costo de operación.', 'Art. 107 ET', ARRAY['transporte'], ARRAY['ambas']),
('Peajes', 'Pago de peajes en la operación de transporte de carga es deducible. Conservar tickets o factura electrónica de la concesión vial.', 'Art. 107 ET', ARRAY['transporte'], ARRAY['ambas']),
('Impuesto al Patrimonio Vehículos', 'Vehículos de carga superiores a 10.5 toneladas pueden tener tarifas diferenciales de impuesto vehicular según municipio.', 'Ley 488/1998', ARRAY['transporte'], ARRAY['ambas']),
('Inventarios — Sistema Permanente', 'Para comerciantes obligados a llevar libros, el costo de la mercancía vendida se determina por el sistema de inventario permanente.', 'Art. 62 ET', ARRAY['comercio'], ARRAY['juridica']),
('Pérdidas en Mercancía', 'Las pérdidas por hurto, robo o daño de mercancía son deducibles hasta el 3% de la suma del inventario inicial más compras del año.', 'Art. 64 ET', ARRAY['comercio'], ARRAY['ambas']),
('Publicidad Deducible', 'Gastos de publicidad y propaganda son deducibles hasta el 15% de las ventas brutas del año fiscal.', 'Art. 107-1 ET', ARRAY['comercio', 'servicios'], ARRAY['ambas']),
('Honorarios Profesionales', 'Ingresos por honorarios sin vínculo laboral. Sujetos a retención en la fuente del 10% u 11% según declarante o no.', 'Art. 392 ET', ARRAY['servicios'], ARRAY['natural']),
('Servicios Personales — Renta Exenta 25%', 'Personas naturales que perciben honorarios sin contratar 2+ trabajadores pueden tomar 25% de renta exenta limitado a 2.880 UVT/año.', 'Art. 206 num 10 ET', ARRAY['servicios'], ARRAY['natural']),
('Beneficios Tributarios I+D+i', 'Inversiones en investigación, desarrollo tecnológico e innovación dan derecho a deducción del 100% + descuento adicional del 25%.', 'Art. 158-1 ET', ARRAY['manufactura', 'servicios'], ARRAY['juridica']),
('Materia Prima Importada', 'IVA pagado en importación de materia prima da derecho a impuesto descontable si se destina a actividad gravada.', 'Art. 485 ET', ARRAY['manufactura', 'comercio'], ARRAY['ambas']),
('Mano de Obra Directa', 'Salarios, prestaciones y aportes parafiscales del personal de planta son costo deducible al 100%, sujeto a pago efectivo de aportes.', 'Art. 108 ET', ARRAY['manufactura'], ARRAY['ambas']),
('Beneficio Zona Franca', 'Empresas industriales en Zona Franca tienen tarifa especial de renta del 20% (vs 35% régimen ordinario).', 'Art. 240-1 ET', ARRAY['manufactura'], ARRAY['juridica']),
('Exportación — IVA Exento', 'Las exportaciones de bienes son operaciones exentas de IVA con derecho a devolución de saldos a favor.', 'Art. 479 ET', ARRAY['manufactura', 'comercio'], ARRAY['ambas']),
('Información Exógena', 'Reporte anual a la DIAN de operaciones con terceros (Formato 1001-1012). Obligados según ingresos del año anterior.', 'Resolución DIAN anual', ARRAY['todos'], ARRAY['ambas']),
('Factura Electrónica', 'Soporte fiscal obligatorio. Sin factura electrónica no hay derecho a costo, gasto deducible ni IVA descontable.', 'Art. 615-616 ET + Decreto 358/2020', ARRAY['todos'], ARRAY['ambas']),
('Sanciones por Extemporaneidad', 'Presentar declaración tarde genera sanción del 5% del impuesto a cargo por mes o fracción de retraso, mínimo 10 UVT.', 'Art. 641 ET', ARRAY['todos'], ARRAY['ambas']),
('Beneficio Auditoría', 'Declaración firme en 6 meses si impuesto neto de renta del año aumenta al menos 35% respecto al año anterior.', 'Art. 689-2 ET', ARRAY['todos'], ARRAY['ambas']),
('Saldos a Favor', 'Saldos a favor en IVA o renta pueden compensarse con otros impuestos o solicitarse en devolución dentro de los 2 años siguientes.', 'Art. 850 ET', ARRAY['todos'], ARRAY['ambas']),
('ICA', 'Impuesto de Industria y Comercio. Municipal. Tarifas entre 2x1000 y 13.8x1000 según actividad y municipio.', 'Ley 14/1983', ARRAY['todos'], ARRAY['ambas']),
('Reteica', 'Retención del ICA en la fuente. Tarifas y agentes de retención fijados por cada municipio.', 'Acuerdos municipales', ARRAY['todos'], ARRAY['ambas']),
('Aportes Parafiscales', 'SENA 2%, ICBF 3%, Cajas Compensación 4% sobre nómina. Pago efectivo es requisito de deducibilidad de salarios.', 'Ley 21/1982', ARRAY['todos'], ARRAY['ambas'])
ON CONFLICT DO NOTHING;

-- 6. Seed tax_deadlines DIAN 2026
INSERT INTO public.tax_deadlines (obligation, entity_type, sector, period, due_date, nit_last_digit, description, estatuto_article) VALUES
('IVA Bimestral Ene-Feb', 'ambas', 'todos', 'bimestral', '2026-03-10', 1, 'Declaración bimestral IVA Enero-Febrero 2026 — NIT terminado en 1', 'Art. 600 ET'),
('IVA Bimestral Ene-Feb', 'ambas', 'todos', 'bimestral', '2026-03-11', 2, 'Declaración bimestral IVA Enero-Febrero 2026 — NIT terminado en 2', 'Art. 600 ET'),
('IVA Bimestral Ene-Feb', 'ambas', 'todos', 'bimestral', '2026-03-12', 3, 'Declaración bimestral IVA Enero-Febrero 2026 — NIT terminado en 3', 'Art. 600 ET'),
('IVA Bimestral Ene-Feb', 'ambas', 'todos', 'bimestral', '2026-03-13', 4, 'Declaración bimestral IVA Enero-Febrero 2026 — NIT terminado en 4', 'Art. 600 ET'),
('IVA Bimestral Ene-Feb', 'ambas', 'todos', 'bimestral', '2026-03-16', 5, 'Declaración bimestral IVA Enero-Febrero 2026 — NIT terminado en 5', 'Art. 600 ET'),
('IVA Bimestral Mar-Abr', 'ambas', 'todos', 'bimestral', '2026-05-12', 1, 'Declaración bimestral IVA Marzo-Abril 2026 — NIT terminado en 1', 'Art. 600 ET'),
('IVA Bimestral May-Jun', 'ambas', 'todos', 'bimestral', '2026-07-09', 1, 'Declaración bimestral IVA Mayo-Junio 2026 — NIT terminado en 1', 'Art. 600 ET'),
('ReteFuente Enero', 'ambas', 'todos', 'mensual', '2026-02-10', 1, 'Declaración mensual ReteFuente Enero 2026 — NIT 1', 'Art. 376 ET'),
('ReteFuente Febrero', 'ambas', 'todos', 'mensual', '2026-03-10', 1, 'Declaración mensual ReteFuente Febrero 2026 — NIT 1', 'Art. 376 ET'),
('ReteFuente Marzo', 'ambas', 'todos', 'mensual', '2026-04-13', 1, 'Declaración mensual ReteFuente Marzo 2026 — NIT 1', 'Art. 376 ET'),
('Renta Personas Jurídicas', 'juridica', 'todos', 'anual', '2026-04-08', 1, 'Declaración Renta y Complementarios PJ año gravable 2025 — NIT 1', 'Art. 591-592 ET'),
('Renta Personas Jurídicas', 'juridica', 'todos', 'anual', '2026-04-09', 2, 'Declaración Renta y Complementarios PJ año gravable 2025 — NIT 2', 'Art. 591-592 ET'),
('Renta Personas Jurídicas', 'juridica', 'todos', 'anual', '2026-04-10', 3, 'Declaración Renta y Complementarios PJ año gravable 2025 — NIT 3', 'Art. 591-592 ET'),
('Renta Personas Naturales', 'natural', 'todos', 'anual', '2026-08-11', 1, 'Declaración Renta PN año gravable 2025 — Cédula terminada en 01-02', 'Art. 592 ET'),
('Renta Personas Naturales', 'natural', 'todos', 'anual', '2026-08-12', 2, 'Declaración Renta PN año gravable 2025 — Cédula terminada en 03-04', 'Art. 592 ET'),
('Régimen Simple — Anticipo', 'ambas', 'todos', 'bimestral', '2026-03-13', 1, 'Anticipo bimestral RST primer bimestre 2026', 'Art. 910 ET'),
('Información Exógena 2025', 'ambas', 'todos', 'anual', '2026-04-15', 1, 'Reporte de información exógena año gravable 2025 (Formatos 1001-1012)', 'Resolución DIAN'),
('ICA Bogotá Bimestral', 'ambas', 'todos', 'bimestral', '2026-03-20', NULL, 'Declaración y pago bimestral ICA Bogotá Ene-Feb 2026', 'Acuerdo 65/2002'),
('Declaración Activos en el Exterior', 'ambas', 'todos', 'anual', '2026-04-15', 1, 'Declaración anual de activos poseídos en el exterior — NIT 1', 'Art. 607 ET'),
('Renta Régimen Simple', 'ambas', 'todos', 'anual', '2026-10-22', 1, 'Declaración anual consolidada Régimen Simple año gravable 2025 — NIT 1', 'Art. 915 ET')
ON CONFLICT DO NOTHING;