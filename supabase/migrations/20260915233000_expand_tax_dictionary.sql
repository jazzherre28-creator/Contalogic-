-- 7. Expand tax_dictionary with frequently searched Colombian tax terms.
ALTER TABLE public.tax_dictionary
  ADD COLUMN IF NOT EXISTS sectors text[] NOT NULL DEFAULT ARRAY['todos'];

INSERT INTO public.tax_dictionary (term, definition, estatuto_article, sectors, entity_types) VALUES
('Régimen Ordinario', 'Régimen general del impuesto sobre la renta para contribuyentes que no pertenecen a un régimen especial u opcional.', 'Art. 240 ET', ARRAY['todos'], ARRAY['ambas']),
('Declaración de Renta', 'Declaración anual en la que se informan ingresos, costos, deducciones, patrimonio y retenciones para determinar el impuesto de renta.', 'Art. 591-594 ET', ARRAY['todos'], ARRAY['ambas']),
('Patrimonio Bruto', 'Total de bienes y derechos apreciables en dinero poseídos al cierre del año gravable, antes de restar las deudas.', 'Art. 261 ET', ARRAY['todos'], ARRAY['ambas']),
('Patrimonio Líquido', 'Patrimonio bruto menos las deudas válidamente respaldadas existentes al cierre del año gravable.', 'Art. 282 ET', ARRAY['todos'], ARRAY['ambas']),
('Ganancia Ocasional', 'Ingreso extraordinario obtenido, entre otros casos, por venta de activos fijos poseídos durante dos años o más, herencias y donaciones.', 'Art. 299-317 ET', ARRAY['todos'], ARRAY['ambas']),
('Retención en la Fuente', 'Recaudo anticipado de un impuesto practicado por quien realiza el pago o abono en cuenta, de acuerdo con el concepto y la tarifa aplicable.', 'Art. 365-404 ET', ARRAY['todos'], ARRAY['ambas']),
('Autorretención', 'Retención que el mismo contribuyente se practica sobre sus ingresos cuando tiene la calidad y responsabilidad definida por la normativa tributaria.', 'Art. 1.2.6.6-1.2.6.11 DUR', ARRAY['todos'], ARRAY['ambas']),
('Documento Equivalente Electrónico', 'Documento que soporta operaciones específicas cuando no se expide factura de venta, sujeto a generación y transmisión electrónica en los casos exigidos.', 'Art. 1.6.1.4.6 DUR', ARRAY['todos'], ARRAY['ambas']),
('Nómina Electrónica', 'Documento electrónico que soporta costos y deducciones laborales y se transmite a la DIAN dentro de los plazos establecidos.', 'Resolución DIAN 000013/2021', ARRAY['todos'], ARRAY['ambas']),
('IVA Descontable', 'Impuesto sobre las ventas pagado en compras o importaciones que puede descontarse del IVA generado cuando cumple los requisitos legales.', 'Art. 485-488 ET', ARRAY['comercio', 'manufactura', 'servicios'], ARRAY['ambas']),
('Retención de IVA', 'Porcentaje del IVA que un agente retenedor detrae del pago al proveedor y consigna posteriormente a la DIAN.', 'Art. 437-1 ET', ARRAY['todos'], ARRAY['ambas']),
('Depreciación Fiscal', 'Deducción por el desgaste de activos productores de renta aplicando la vida útil y los límites fiscales vigentes.', 'Art. 128-141 ET', ARRAY['transporte', 'manufactura', 'comercio'], ARRAY['ambas']),
('Activo Fijo', 'Bien corporal o incorporal destinado a ser utilizado de manera permanente en la actividad productora de renta y no para la venta ordinaria.', 'Art. 60 ET', ARRAY['todos'], ARRAY['ambas']),
('Factura de Compra', 'Documento que respalda la adquisición de bienes o servicios y permite soportar costos, gastos o impuestos descontables cuando cumple requisitos.', 'Art. 771-2 ET', ARRAY['todos'], ARRAY['ambas']),
('Beneficiario Final', 'Persona natural que finalmente posee, controla o se beneficia de una entidad o estructura sin personería jurídica y debe reportarse cuando corresponde.', 'Art. 631-5 ET', ARRAY['todos'], ARRAY['juridica']),
('RUT', 'Registro Único Tributario administrado por la DIAN que identifica, ubica y clasifica a las personas y entidades con obligaciones tributarias.', 'Art. 555-2 ET', ARRAY['todos'], ARRAY['ambas']),
('Responsable de IVA', 'Persona o entidad que realiza operaciones gravadas y debe cumplir las obligaciones de facturación, declaración y pago del IVA según su periodicidad.', 'Art. 437 ET', ARRAY['comercio', 'manufactura', 'servicios'], ARRAY['ambas'])
ON CONFLICT DO NOTHING;
