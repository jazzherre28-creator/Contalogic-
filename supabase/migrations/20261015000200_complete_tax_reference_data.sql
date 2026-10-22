ALTER TABLE public.tax_deadlines
  ADD COLUMN IF NOT EXISTS nit_group TEXT;

UPDATE public.tax_dictionary AS terms
SET definition = updates.definition,
    estatuto_article = updates.estatuto_article
FROM (VALUES
  ('UVT', 'Unidad de Valor Tributario: unidad de cuenta que la DIAN actualiza cada año para expresar valores previstos en la legislación tributaria. Consulta el valor vigente del año gravable que corresponda.', 'Art. 868 ET'),
  ('RST', 'El Régimen Simple de Tributación es un régimen opcional de determinación del impuesto unificado para quienes cumplen los requisitos legales. Sustituye el impuesto sobre la renta e integra componentes de ICA; el IVA se declara y paga por separado cuando se es responsable.', 'Arts. 903-916 ET'),
  ('Renta Presuntiva', 'La renta presuntiva fue derogada para los años gravables desde 2021. No debe tratarse como una base mínima vigente para liquidar el impuesto de renta.', 'Art. 188 ET; Ley 2010 de 2019'),
  ('IVA', 'Impuesto indirecto que recae sobre las operaciones gravadas definidas en la ley. La tarifa depende del bien o servicio; la periodicidad de declaración depende de los supuestos legales aplicables al responsable.', 'Arts. 420, 468 y 600 ET'),
  ('Depreciación', 'Distribución del costo fiscal de un activo depreciable durante su vida útil, desde que está disponible para uso y conforme a los métodos, vidas útiles y límites fiscales aplicables. No existe una tarifa única para todos los activos.', 'Arts. 128-140 ET'),
  ('Depreciación Fiscal', 'Deducción que reconoce fiscalmente el desgaste de activos depreciables. La tasa máxima anual depende de la clase de activo y los límites legales; requiere soporte del costo, fecha de disponibilidad y cálculo del periodo.', 'Arts. 128-140 ET'),
  ('Salario Mínimo 2026', 'El salario mínimo legal mensual vigente cambia cada año. Verifica el decreto oficial aplicable al periodo antes de usar esta cifra para nómina, aportes o cálculos tributarios.', 'Decreto anual vigente'),
  ('ACPM Deducible', 'El combustible usado en la actividad puede reconocerse como costo o gasto si cumple los requisitos de causalidad, necesidad, proporcionalidad, soporte y demás reglas aplicables. No es automáticamente deducible en un porcentaje fijo.', 'Arts. 107 y 771-2 ET'),
  ('Mantenimiento Vehicular', 'El mantenimiento relacionado con la actividad puede reconocerse fiscalmente si está soportado, corresponde al contribuyente y cumple los requisitos legales. El tratamiento depende del concepto y no equivale a una deducción automática del 100%.', 'Arts. 107 y 771-2 ET'),
  ('Peajes', 'Los peajes vinculados a la actividad pueden ser costo o gasto cuando se acredita la operación y se conserva el soporte admitido para el caso. Verifica el documento soporte exigible y las reglas de procedencia.', 'Arts. 107 y 771-2 ET'),
  ('Impuesto al Patrimonio Vehículos', 'El impuesto sobre vehículos automotores es distinto del impuesto nacional al patrimonio. Sus elementos y tarifas dependen de la ley y, para algunos aspectos, de la autoridad territorial competente.', 'Ley 488 de 1998'),
  ('Pérdidas en Mercancía', 'Las disminuciones de inventario tienen tratamientos fiscales distintos según su causa y las pruebas disponibles. No existe una deducción general automática del 3%; documenta el evento y revisa el artículo aplicable.', 'Arts. 64 y 148 ET'),
  ('Publicidad Deducible', 'Los gastos de publicidad no tienen un límite general único del 15% de las ventas. Su aceptación fiscal depende de su relación con la actividad, soporte, necesidad, proporcionalidad y reglas especiales que puedan aplicar.', 'Art. 107 ET'),
  ('Beneficios Tributarios I+D+i', 'Los proyectos de investigación, desarrollo e innovación pueden acceder a beneficios tributarios cuando cumplen las condiciones legales, de certificación, cupo y convocatoria vigentes. El beneficio y su cuantía no son automáticos.', 'Arts. 158-1 y 256 ET'),
  ('Beneficio Zona Franca', 'La tarifa de renta y los requisitos de usuarios de zonas francas dependen de la normativa vigente, la clase de usuario y las condiciones exigibles, que pueden incluir compromisos de exportación. No se presume una tarifa única para toda empresa.', 'Art. 240-1 ET'),
  ('Factura Electrónica', 'La factura electrónica de venta es uno de los documentos que soportan operaciones. La obligación de expedirla y los requisitos para aceptar costos, deducciones o impuestos descontables dependen del tipo de operación y de las reglas aplicables.', 'Arts. 615, 616-1 y 771-2 ET'),
  ('Sanciones por Extemporaneidad', 'La sanción por presentar tarde depende del tipo de declaración, el impuesto o ingresos, el tiempo transcurrido y las reglas del Estatuto Tributario. Antes de liquidarla, verifica la base, la tarifa y los mínimos aplicables al caso.', 'Art. 641 ET'),
  ('Beneficio Auditoría', 'El beneficio de auditoría ha estado sujeto a vigencias y requisitos temporales. No se debe asumir que aplica a una declaración actual sin comprobar expresamente que la ley vigente lo contempla para ese año gravable y contribuyente.', 'Art. 689-3 ET'),
  ('ICA', 'Impuesto municipal o distrital sobre actividades industriales, comerciales o de servicios realizadas en la jurisdicción. La actividad, territorialidad, base y tarifa deben verificarse en las normas locales aplicables.', 'Ley 14 de 1983; normativa local')
) AS updates(term, definition, estatuto_article)
WHERE lower(terms.term) = lower(updates.term);

INSERT INTO public.tax_dictionary (term, definition, estatuto_article, sectors, entity_types)
SELECT additions.term, additions.definition, additions.estatuto_article, additions.sectors, additions.entity_types
FROM (VALUES
  ('Año gravable', 'Periodo al que corresponden los ingresos, costos, deducciones, patrimonio y demás partidas reportadas en una declaración. Para renta, usualmente corresponde al año calendario anterior al de presentación.', 'Arts. 1 y 9 ET', ARRAY['todos']::text[], ARRAY['ambas']::text[]),
  ('NIT', 'Número de Identificación Tributaria asignado por la DIAN. Para consultar vencimientos, usa el dígito o grupo exigido para la obligación; no confundas el dígito de verificación con el dígito de vencimiento.', 'Art. 555-2 ET', ARRAY['todos']::text[], ARRAY['ambas']::text[]),
  ('Renta líquida', 'Resultado fiscal que se determina aplicando las reglas legales de depuración de ingresos, costos, deducciones, rentas exentas y demás partidas procedentes. No siempre coincide con la utilidad contable.', 'Arts. 26 y siguientes ET', ARRAY['todos']::text[], ARRAY['ambas']::text[]),
  ('Costo fiscal', 'Valor reconocido fiscalmente para determinar el costo de un activo, inventario u operación. Se establece según las normas aplicables y los soportes del contribuyente.', 'Arts. 58-72 ET', ARRAY['todos']::text[], ARRAY['ambas']::text[]),
  ('Deducción', 'Partida que, si cumple los requisitos legales y está debidamente soportada, se resta para determinar la renta líquida. No equivale a un descuento directo del impuesto.', 'Arts. 105-177 ET', ARRAY['todos']::text[], ARRAY['ambas']::text[]),
  ('Descuento tributario', 'Beneficio que, cuando está autorizado y se cumplen sus condiciones, se resta directamente del impuesto determinado. Puede estar sujeto a límites, certificaciones o restricciones.', 'Arts. 254-259-2 ET', ARRAY['todos']::text[], ARRAY['ambas']::text[]),
  ('IVA generado', 'IVA causado en las operaciones gravadas realizadas por el responsable. Se determina con la tarifa aplicable a cada operación y se declara conforme al periodo que corresponda.', 'Arts. 420 y 429 ET', ARRAY['todos']::text[], ARRAY['ambas']::text[]),
  ('IVA descontable', 'IVA pagado que puede imputarse contra el IVA generado cuando la compra, importación, factura y destinación cumplen los requisitos legales. No todo IVA pagado es descontable.', 'Arts. 485-488 ET', ARRAY['todos']::text[], ARRAY['ambas']::text[]),
  ('Operación exenta de IVA', 'Operación gravada a tarifa cero que, bajo las condiciones legales, puede dar derecho a impuestos descontables o devolución de saldos a favor.', 'Arts. 477-481 ET', ARRAY['todos']::text[], ARRAY['ambas']::text[]),
  ('Operación excluida de IVA', 'Operación que no causa IVA por estar excluida expresamente por la ley. Su tratamiento no es el mismo que el de una operación exenta.', 'Art. 424 y normas concordantes ET', ARRAY['todos']::text[], ARRAY['ambas']::text[]),
  ('Agente retenedor', 'Persona o entidad designada por la ley como responsable de practicar, declarar y consignar retenciones cuando realiza pagos o abonos sujetos a retención.', 'Arts. 368 y siguientes ET', ARRAY['todos']::text[], ARRAY['ambas']::text[]),
  ('Certificado de retención', 'Documento que informa los valores retenidos y consignados por un agente retenedor. Se utiliza para conciliar y soportar la imputación de retenciones en la declaración correspondiente.', 'Arts. 378 y 381 ET', ARRAY['todos']::text[], ARRAY['ambas']::text[]),
  ('Anticipo tributario', 'Pago anticipado imputable al impuesto de un periodo, calculado y pagado bajo las reglas del régimen u obligación respectiva. No es un impuesto adicional por sí mismo.', 'Arts. 807 y 910 ET', ARRAY['todos']::text[], ARRAY['ambas']::text[]),
  ('Saldo a favor', 'Resultado de una declaración en la que los anticipos, retenciones, impuestos descontables u otros conceptos imputables exceden el impuesto a cargo. Su compensación o devolución exige cumplir plazos y requisitos.', 'Arts. 850-865 ET', ARRAY['todos']::text[], ARRAY['ambas']::text[]),
  ('Documento soporte', 'Documento electrónico o soporte admitido por la normativa para respaldar ciertas adquisiciones cuando el proveedor no está obligado a expedir factura de venta o documento equivalente.', 'Art. 771-2 ET; Resolución DIAN 000167/2021', ARRAY['todos']::text[], ARRAY['ambas']::text[]),
  ('Información exógena', 'Reporte de datos sobre operaciones con terceros solicitado por la DIAN a los sujetos y para los años definidos en la resolución anual. Obligados, formatos y fechas cambian según esa resolución.', 'Art. 631 ET; resolución DIAN anual', ARRAY['todos']::text[], ARRAY['ambas']::text[]),
  ('Régimen ordinario', 'Régimen general del impuesto sobre la renta aplicable a quienes no determinan ese impuesto bajo un régimen especial u opcional. La obligación concreta depende de la calidad y situación del contribuyente.', 'Arts. 5 y siguientes ET', ARRAY['todos']::text[], ARRAY['ambas']::text[]),
  ('Declaración de renta', 'Declaración en la que el contribuyente reporta la información fiscal del periodo y determina, cuando corresponda, el impuesto, saldo a pagar o saldo a favor.', 'Arts. 591-594 ET', ARRAY['todos']::text[], ARRAY['ambas']::text[]),
  ('Patrimonio líquido', 'Diferencia entre el patrimonio bruto y las deudas aceptadas fiscalmente al cierre del periodo, de acuerdo con las reglas y soportes aplicables.', 'Arts. 261 y 282 ET', ARRAY['todos']::text[], ARRAY['ambas']::text[]),
  ('Registro Único Tributario (RUT)', 'Registro administrado por la DIAN que identifica, ubica y clasifica a los sujetos con obligaciones administradas por la entidad. Debe actualizarse cuando cambia la información que allí consta.', 'Art. 555-2 ET', ARRAY['todos']::text[], ARRAY['ambas']::text[]),
  ('Calendario tributario', 'Acto oficial que establece plazos para obligaciones administradas por la DIAN. La fecha puede depender del año, el tipo de obligación, la periodicidad y el NIT; verifica el calendario oficial y sus modificaciones.', 'Decreto anual de plazos DIAN', ARRAY['todos']::text[], ARRAY['ambas']::text[]),
  ('Firmeza de la declaración', 'Momento a partir del cual la declaración ya no puede ser modificada por la administración, salvo excepciones legales. El término depende de la declaración y de las circunstancias del contribuyente.', 'Arts. 705-714 ET', ARRAY['todos']::text[], ARRAY['ambas']::text[]),
  ('Conciliación fiscal', 'Proceso de identificación y explicación de diferencias entre las cifras contables y las fiscales, de acuerdo con los requerimientos aplicables al contribuyente.', 'Art. 772-1 ET; Decreto 1625 de 2016', ARRAY['todos']::text[], ARRAY['ambas']::text[]),
  ('Impuesto al consumo', 'Impuesto nacional que grava las operaciones específicamente señaladas por la ley. Sus hechos generadores y responsables son distintos del IVA y deben revisarse según el bien o servicio.', 'Arts. 512-1 y siguientes ET', ARRAY['todos']::text[], ARRAY['ambas']::text[]),
  ('ReteICA', 'Retención del impuesto de industria y comercio practicada conforme a las reglas del municipio o distrito competente. Los agentes, bases y tarifas pueden variar localmente.', 'Normativa municipal o distrital', ARRAY['todos']::text[], ARRAY['ambas']::text[])
) AS additions(term, definition, estatuto_article, sectors, entity_types)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.tax_dictionary AS existing
  WHERE lower(existing.term) = lower(additions.term)
);

WITH periods(obligation, entity_type, period, due_year, due_month, due_days, article) AS (
  VALUES
    ('IVA bimestral', 'ambas', '2026 · Ene-Feb', 2026, 3, ARRAY[10,11,12,13,16,17,18,19,20,24], 'Art. 600 ET'),
    ('IVA bimestral', 'ambas', '2026 · Mar-Abr', 2026, 5, ARRAY[12,13,14,15,19,20,21,22,25,26], 'Art. 600 ET'),
    ('IVA bimestral', 'ambas', '2026 · May-Jun', 2026, 7, ARRAY[9,10,14,15,16,17,21,22,23,24], 'Art. 600 ET'),
    ('IVA bimestral', 'ambas', '2026 · Jul-Ago', 2026, 9, ARRAY[9,10,11,14,15,16,17,18,21,22], 'Art. 600 ET'),
    ('IVA bimestral', 'ambas', '2026 · Sep-Oct', 2026, 11, ARRAY[11,12,13,17,18,19,20,23,24,25], 'Art. 600 ET'),
    ('IVA bimestral', 'ambas', '2026 · Nov-Dic', 2027, 1, ARRAY[13,14,15,18,19,20,21,22,25,26], 'Art. 600 ET'),
    ('IVA cuatrimestral', 'ambas', '2026 · Ene-Abr', 2026, 5, ARRAY[12,13,14,15,19,20,21,22,25,26], 'Art. 600 ET'),
    ('IVA cuatrimestral', 'ambas', '2026 · May-Ago', 2026, 9, ARRAY[9,10,11,14,15,16,17,18,21,22], 'Art. 600 ET'),
    ('IVA cuatrimestral', 'ambas', '2026 · Sep-Dic', 2027, 1, ARRAY[13,14,15,18,19,20,21,22,25,26], 'Art. 600 ET'),
    ('Retención en la fuente', 'ambas', '2026 · Ene', 2026, 2, ARRAY[10,11,12,13,16,17,18,19,20,23], 'Art. 376 ET'),
    ('Retención en la fuente', 'ambas', '2026 · Feb', 2026, 3, ARRAY[10,11,12,13,16,17,18,19,20,24], 'Art. 376 ET'),
    ('Retención en la fuente', 'ambas', '2026 · Mar', 2026, 4, ARRAY[13,14,15,16,20,21,22,23,24,27], 'Art. 376 ET'),
    ('Retención en la fuente', 'ambas', '2026 · Abr', 2026, 5, ARRAY[12,13,14,15,19,20,21,22,25,26], 'Art. 376 ET'),
    ('Retención en la fuente', 'ambas', '2026 · May', 2026, 6, ARRAY[10,11,12,16,17,18,19,22,23,24], 'Art. 376 ET'),
    ('Retención en la fuente', 'ambas', '2026 · Jun', 2026, 7, ARRAY[9,10,14,15,16,17,21,22,23,24], 'Art. 376 ET'),
    ('Retención en la fuente', 'ambas', '2026 · Jul', 2026, 8, ARRAY[12,13,14,18,19,20,21,24,25,26], 'Art. 376 ET'),
    ('Retención en la fuente', 'ambas', '2026 · Ago', 2026, 9, ARRAY[9,10,11,14,15,16,17,18,21,22], 'Art. 376 ET'),
    ('Retención en la fuente', 'ambas', '2026 · Sep', 2026, 10, ARRAY[9,13,14,15,16,19,20,21,22,23], 'Art. 376 ET'),
    ('Retención en la fuente', 'ambas', '2026 · Oct', 2026, 11, ARRAY[11,12,13,17,18,19,20,23,24,25], 'Art. 376 ET'),
    ('Retención en la fuente', 'ambas', '2026 · Nov', 2026, 12, ARRAY[10,11,14,15,16,17,18,21,22,23], 'Art. 376 ET'),
    ('Retención en la fuente', 'ambas', '2026 · Dic', 2027, 1, ARRAY[13,14,15,18,19,20,21,22,25,26], 'Art. 376 ET'),
    ('Anticipo bimestral RST', 'ambas', '2026 · Ene-Feb', 2026, 5, ARRAY[12,13,14,15,19,20,21,22,25,26], 'Art. 910 ET'),
    ('Anticipo bimestral RST', 'ambas', '2026 · Mar-Abr', 2026, 6, ARRAY[13,14,15,16,20,21,22,23,24,27], 'Art. 910 ET'),
    ('Anticipo bimestral RST', 'ambas', '2026 · May-Jun', 2026, 7, ARRAY[9,10,14,15,16,17,21,22,23,24], 'Art. 910 ET'),
    ('Anticipo bimestral RST', 'ambas', '2026 · Jul-Ago', 2026, 9, ARRAY[9,10,11,14,15,16,17,18,21,22], 'Art. 910 ET'),
    ('Anticipo bimestral RST', 'ambas', '2026 · Sep-Oct', 2026, 11, ARRAY[11,12,13,17,18,19,20,23,24,25], 'Art. 910 ET'),
    ('Anticipo bimestral RST', 'ambas', '2026 · Nov-Dic', 2027, 1, ARRAY[13,14,15,18,19,20,21,22,25,26], 'Art. 910 ET')
),
dated_rows AS (
  SELECT
    p.obligation,
    p.entity_type,
    'todos'::text AS sector,
    p.period,
    make_date(p.due_year, p.due_month, d.due_day) AS due_date,
    CASE WHEN d.digit_position = 10 THEN 0 ELSE d.digit_position::integer END AS nit_last_digit,
    format('Vencimiento oficial DIAN para NIT terminado en %s.', CASE WHEN d.digit_position = 10 THEN 0 ELSE d.digit_position END) AS description,
    p.article AS estatuto_article
  FROM periods AS p
  CROSS JOIN LATERAL unnest(p.due_days) WITH ORDINALITY AS d(due_day, digit_position)
)
INSERT INTO public.tax_deadlines
  (obligation, entity_type, sector, period, due_date, nit_last_digit, description, estatuto_article)
SELECT r.obligation, r.entity_type, r.sector, r.period, r.due_date, r.nit_last_digit, r.description, r.estatuto_article
FROM dated_rows AS r
WHERE NOT EXISTS (
  SELECT 1
  FROM public.tax_deadlines AS existing
  WHERE existing.obligation = r.obligation
    AND existing.entity_type = r.entity_type
    AND existing.period = r.period
    AND existing.due_date = r.due_date
    AND existing.nit_last_digit = r.nit_last_digit
);

WITH rent_due(obligation, period, entity_type, due_month, due_year, due_days, article) AS (
  VALUES
    ('Renta grandes contribuyentes · primera cuota', 'Año gravable 2025', 'juridica', 2, 2026, ARRAY[10,11,12,13,16,17,18,19,20,23], 'Art. 1.6.1.13.2.11 DUR'),
    ('Renta grandes contribuyentes · declaración y segunda cuota', 'Año gravable 2025', 'juridica', 4, 2026, ARRAY[13,14,15,16,20,21,22,23,24,27], 'Art. 1.6.1.13.2.11 DUR'),
    ('Renta grandes contribuyentes · tercera cuota', 'Año gravable 2025', 'juridica', 6, 2026, ARRAY[10,11,12,16,17,18,19,22,23,24], 'Art. 1.6.1.13.2.11 DUR'),
    ('Renta personas jurídicas · primera cuota', 'Año gravable 2025', 'juridica', 5, 2026, ARRAY[12,13,14,15,19,20,21,22,25,26], 'Art. 1.6.1.13.2.12 DUR'),
    ('Renta personas jurídicas · declaración y segunda cuota', 'Año gravable 2025', 'juridica', 7, 2026, ARRAY[9,10,14,15,16,17,21,22,23,24], 'Art. 1.6.1.13.2.12 DUR')
),
dated_rows AS (
  SELECT r.obligation, r.entity_type, 'todos'::text AS sector, r.period,
    make_date(r.due_year, r.due_month, d.due_day) AS due_date,
    CASE WHEN d.digit_position = 10 THEN 0 ELSE d.digit_position::integer END AS nit_last_digit,
    format('Vencimiento oficial DIAN para NIT terminado en %s.', CASE WHEN d.digit_position = 10 THEN 0 ELSE d.digit_position END) AS description,
    r.article AS estatuto_article
  FROM rent_due AS r
  CROSS JOIN LATERAL unnest(r.due_days) WITH ORDINALITY AS d(due_day, digit_position)
)
INSERT INTO public.tax_deadlines
  (obligation, entity_type, sector, period, due_date, nit_last_digit, description, estatuto_article)
SELECT r.obligation, r.entity_type, r.sector, r.period, r.due_date, r.nit_last_digit, r.description, r.estatuto_article
FROM dated_rows AS r
WHERE NOT EXISTS (
  SELECT 1 FROM public.tax_deadlines AS existing
  WHERE existing.obligation = r.obligation AND existing.period = r.period
    AND existing.due_date = r.due_date AND existing.nit_last_digit = r.nit_last_digit
);

WITH personal_groups(nit_group, due_month, due_year, due_day) AS (
  VALUES
    ('01-02',8,2026,12), ('03-04',8,2026,13), ('05-06',8,2026,14), ('07-08',8,2026,18), ('09-10',8,2026,19),
    ('11-12',8,2026,20), ('13-14',8,2026,21), ('15-16',8,2026,24), ('17-18',8,2026,25), ('19-20',8,2026,26),
    ('21-22',8,2026,27), ('23-24',8,2026,28), ('25-26',8,2026,31),
    ('27-28',9,2026,1), ('29-30',9,2026,2), ('31-32',9,2026,3), ('33-34',9,2026,4), ('35-36',9,2026,7),
    ('37-38',9,2026,8), ('39-40',9,2026,9), ('41-42',9,2026,10), ('43-44',9,2026,11), ('45-46',9,2026,14),
    ('47-48',9,2026,15), ('49-50',9,2026,16), ('51-52',9,2026,17), ('53-54',9,2026,18), ('55-56',9,2026,21),
    ('57-58',9,2026,22), ('59-60',9,2026,23), ('61-62',9,2026,24), ('63-64',9,2026,25), ('65-66',9,2026,28),
    ('67-68',10,2026,1), ('69-70',10,2026,2), ('71-72',10,2026,5), ('73-74',10,2026,6), ('75-76',10,2026,7),
    ('77-78',10,2026,8), ('79-80',10,2026,9), ('81-82',10,2026,13), ('83-84',10,2026,14), ('85-86',10,2026,15),
    ('87-88',10,2026,16), ('89-90',10,2026,19), ('91-92',10,2026,20), ('93-94',10,2026,21),
    ('95-96',10,2026,22), ('97-98',10,2026,23), ('99-00',10,2026,26)
)
INSERT INTO public.tax_deadlines
  (obligation, entity_type, sector, period, due_date, nit_last_digit, nit_group, description, estatuto_article)
SELECT
  'Renta personas naturales',
  'natural',
  'todos',
  'Año gravable 2025',
  make_date(g.due_year, g.due_month, g.due_day),
  NULL,
  g.nit_group,
  format('Declaración y pago de renta de persona natural. Vencimiento oficial DIAN para NIT terminado en %s.', g.nit_group),
  'Art. 1.6.1.13.2.14 DUR'
FROM personal_groups AS g
WHERE NOT EXISTS (
  SELECT 1 FROM public.tax_deadlines AS existing
  WHERE existing.obligation = 'Renta personas naturales'
    AND existing.period = 'Año gravable 2025'
    AND existing.nit_group = g.nit_group
);

WITH grouped_dates(obligation, period, entity_type, due_year, due_month, due_day, nit_group, article) AS (
  VALUES
    ('Régimen Simple · declaración anual', 'Año gravable 2025', 'ambas', 2026, 4, 20, '1-2', 'Art. 1.6.1.13.2.50 DUR'),
    ('Régimen Simple · declaración anual', 'Año gravable 2025', 'ambas', 2026, 4, 21, '3-4', 'Art. 1.6.1.13.2.50 DUR'),
    ('Régimen Simple · declaración anual', 'Año gravable 2025', 'ambas', 2026, 4, 22, '5-6', 'Art. 1.6.1.13.2.50 DUR'),
    ('Régimen Simple · declaración anual', 'Año gravable 2025', 'ambas', 2026, 4, 23, '7-8', 'Art. 1.6.1.13.2.50 DUR'),
    ('Régimen Simple · declaración anual', 'Año gravable 2025', 'ambas', 2026, 4, 24, '9-0', 'Art. 1.6.1.13.2.50 DUR'),
    ('Régimen Simple · IVA anual consolidado', 'Año gravable 2025', 'ambas', 2026, 2, 16, '1-2', 'Art. 1.6.1.13.2.50 DUR'),
    ('Régimen Simple · IVA anual consolidado', 'Año gravable 2025', 'ambas', 2026, 2, 17, '3-4', 'Art. 1.6.1.13.2.50 DUR'),
    ('Régimen Simple · IVA anual consolidado', 'Año gravable 2025', 'ambas', 2026, 2, 18, '5-6', 'Art. 1.6.1.13.2.50 DUR'),
    ('Régimen Simple · IVA anual consolidado', 'Año gravable 2025', 'ambas', 2026, 2, 19, '7-8', 'Art. 1.6.1.13.2.50 DUR'),
    ('Régimen Simple · IVA anual consolidado', 'Año gravable 2025', 'ambas', 2026, 2, 20, '9-0', 'Art. 1.6.1.13.2.50 DUR'),
    ('Impuesto al patrimonio · primera cuota', 'Año gravable 2026', 'ambas', 2026, 5, 12, '1', 'Art. 1.6.1.13.2.53 DUR'),
    ('Impuesto al patrimonio · primera cuota', 'Año gravable 2026', 'ambas', 2026, 5, 13, '2', 'Art. 1.6.1.13.2.53 DUR'),
    ('Impuesto al patrimonio · primera cuota', 'Año gravable 2026', 'ambas', 2026, 5, 14, '3', 'Art. 1.6.1.13.2.53 DUR'),
    ('Impuesto al patrimonio · primera cuota', 'Año gravable 2026', 'ambas', 2026, 5, 15, '4', 'Art. 1.6.1.13.2.53 DUR'),
    ('Impuesto al patrimonio · primera cuota', 'Año gravable 2026', 'ambas', 2026, 5, 19, '5', 'Art. 1.6.1.13.2.53 DUR'),
    ('Impuesto al patrimonio · primera cuota', 'Año gravable 2026', 'ambas', 2026, 5, 20, '6', 'Art. 1.6.1.13.2.53 DUR'),
    ('Impuesto al patrimonio · primera cuota', 'Año gravable 2026', 'ambas', 2026, 5, 21, '7', 'Art. 1.6.1.13.2.53 DUR'),
    ('Impuesto al patrimonio · primera cuota', 'Año gravable 2026', 'ambas', 2026, 5, 22, '8', 'Art. 1.6.1.13.2.53 DUR'),
    ('Impuesto al patrimonio · primera cuota', 'Año gravable 2026', 'ambas', 2026, 5, 25, '9', 'Art. 1.6.1.13.2.53 DUR'),
    ('Impuesto al patrimonio · primera cuota', 'Año gravable 2026', 'ambas', 2026, 5, 26, '0', 'Art. 1.6.1.13.2.53 DUR'),
    ('Precios de transferencia · declaración informativa', 'Año gravable 2025', 'juridica', 2026, 9, 9, '1', 'Arts. 260-9 y 260-11 ET'),
    ('Precios de transferencia · declaración informativa', 'Año gravable 2025', 'juridica', 2026, 9, 10, '2', 'Arts. 260-9 y 260-11 ET'),
    ('Precios de transferencia · declaración informativa', 'Año gravable 2025', 'juridica', 2026, 9, 11, '3', 'Arts. 260-9 y 260-11 ET'),
    ('Precios de transferencia · declaración informativa', 'Año gravable 2025', 'juridica', 2026, 9, 14, '4', 'Arts. 260-9 y 260-11 ET'),
    ('Precios de transferencia · declaración informativa', 'Año gravable 2025', 'juridica', 2026, 9, 15, '5', 'Arts. 260-9 y 260-11 ET'),
    ('Precios de transferencia · declaración informativa', 'Año gravable 2025', 'juridica', 2026, 9, 16, '6', 'Arts. 260-9 y 260-11 ET'),
    ('Precios de transferencia · declaración informativa', 'Año gravable 2025', 'juridica', 2026, 9, 17, '7', 'Arts. 260-9 y 260-11 ET'),
    ('Precios de transferencia · declaración informativa', 'Año gravable 2025', 'juridica', 2026, 9, 18, '8', 'Arts. 260-9 y 260-11 ET'),
    ('Precios de transferencia · declaración informativa', 'Año gravable 2025', 'juridica', 2026, 9, 21, '9', 'Arts. 260-9 y 260-11 ET'),
    ('Precios de transferencia · declaración informativa', 'Año gravable 2025', 'juridica', 2026, 9, 22, '0', 'Arts. 260-9 y 260-11 ET'),
    ('Precios de transferencia · documentación comprobatoria', 'Año gravable 2025', 'juridica', 2026, 9, 9, '1', 'Arts. 260-5 y 260-11 ET'),
    ('Precios de transferencia · documentación comprobatoria', 'Año gravable 2025', 'juridica', 2026, 9, 10, '2', 'Arts. 260-5 y 260-11 ET'),
    ('Precios de transferencia · documentación comprobatoria', 'Año gravable 2025', 'juridica', 2026, 9, 11, '3', 'Arts. 260-5 y 260-11 ET'),
    ('Precios de transferencia · documentación comprobatoria', 'Año gravable 2025', 'juridica', 2026, 9, 14, '4', 'Arts. 260-5 y 260-11 ET'),
    ('Precios de transferencia · documentación comprobatoria', 'Año gravable 2025', 'juridica', 2026, 9, 15, '5', 'Arts. 260-5 y 260-11 ET'),
    ('Precios de transferencia · documentación comprobatoria', 'Año gravable 2025', 'juridica', 2026, 9, 16, '6', 'Arts. 260-5 y 260-11 ET'),
    ('Precios de transferencia · documentación comprobatoria', 'Año gravable 2025', 'juridica', 2026, 9, 17, '7', 'Arts. 260-5 y 260-11 ET'),
    ('Precios de transferencia · documentación comprobatoria', 'Año gravable 2025', 'juridica', 2026, 9, 18, '8', 'Arts. 260-5 y 260-11 ET'),
    ('Precios de transferencia · documentación comprobatoria', 'Año gravable 2025', 'juridica', 2026, 9, 21, '9', 'Arts. 260-5 y 260-11 ET'),
    ('Precios de transferencia · documentación comprobatoria', 'Año gravable 2025', 'juridica', 2026, 9, 22, '0', 'Arts. 260-5 y 260-11 ET')
)
INSERT INTO public.tax_deadlines
  (obligation, entity_type, sector, period, due_date, nit_last_digit, nit_group, description, estatuto_article)
SELECT g.obligation, g.entity_type, 'todos', g.period, make_date(g.due_year, g.due_month, g.due_day),
  CASE WHEN g.obligation LIKE 'Impuesto al patrimonio%' OR g.obligation LIKE 'Precios de transferencia%' THEN g.nit_group::integer ELSE NULL END,
  CASE WHEN g.obligation LIKE 'Régimen Simple%' THEN g.nit_group ELSE NULL END,
  format('Fecha oficial DIAN. Grupo o terminación de NIT: %s.', g.nit_group),
  g.article
FROM grouped_dates AS g
WHERE NOT EXISTS (
  SELECT 1 FROM public.tax_deadlines AS existing
  WHERE existing.obligation = g.obligation AND existing.period = g.period
    AND existing.due_date = make_date(g.due_year, g.due_month, g.due_day)
    AND existing.nit_last_digit IS NOT DISTINCT FROM
      CASE WHEN g.obligation LIKE 'Impuesto al patrimonio%' OR g.obligation LIKE 'Precios de transferencia%' THEN g.nit_group::integer ELSE NULL END
    AND existing.nit_group IS NOT DISTINCT FROM CASE WHEN g.obligation LIKE 'Régimen Simple%' THEN g.nit_group ELSE NULL END
);

INSERT INTO public.tax_deadlines
  (obligation, entity_type, sector, period, due_date, nit_last_digit, description, estatuto_article)
SELECT 'Impuesto al patrimonio · segunda cuota', 'ambas', 'todos', 'Año gravable 2026',
  make_date(2026, 9, 14), NULL,
  'Pago de la segunda cuota; fecha señalada por el calendario DIAN independientemente del NIT.',
  'Art. 1.6.1.13.2.53 DUR'
WHERE NOT EXISTS (
  SELECT 1 FROM public.tax_deadlines
  WHERE obligation = 'Impuesto al patrimonio · segunda cuota'
    AND period = 'Año gravable 2026' AND due_date = make_date(2026, 9, 14)
);

WITH pes_periods(period, due_year, due_month, due_day) AS (
  VALUES
    ('2026 · Ene-Feb',2026,3,13), ('2026 · Mar-Abr',2026,5,15), ('2026 · May-Jun',2026,7,15),
    ('2026 · Jul-Ago',2026,9,14), ('2026 · Sep-Oct',2026,11,17), ('2026 · Nov-Dic',2027,1,18)
)
INSERT INTO public.tax_deadlines
  (obligation, entity_type, sector, period, due_date, description, estatuto_article)
SELECT 'Presencia Económica Significativa · pago anticipado', 'ambas', 'todos', p.period,
  make_date(p.due_year, p.due_month, p.due_day),
  'Pago anticipado bimestral para sujetos que cumplen las condiciones del régimen PES. Confirma la obligación y el medio de pago aplicables.',
  'Arts. 20-3 y 408 ET'
FROM pes_periods AS p
WHERE NOT EXISTS (
  SELECT 1 FROM public.tax_deadlines AS existing
  WHERE existing.obligation = 'Presencia Económica Significativa · pago anticipado'
    AND existing.period = p.period
    AND existing.due_date = make_date(p.due_year, p.due_month, p.due_day)
);

INSERT INTO public.tax_deadlines
  (obligation, entity_type, sector, period, due_date, description, estatuto_article)
SELECT 'Presencia Económica Significativa · declaración anual', 'ambas', 'todos',
  'Año gravable 2025', make_date(2026,4,23),
  'Fecha de declaración anual señalada por DIAN, independientemente del NIT. Aplica solo a sujetos que cumplen las condiciones del régimen PES.',
  'Arts. 20-3 y 408 ET'
WHERE NOT EXISTS (
  SELECT 1 FROM public.tax_deadlines
  WHERE obligation = 'Presencia Económica Significativa · declaración anual'
    AND period = 'Año gravable 2025' AND due_date = make_date(2026,4,23)
);

INSERT INTO public.tax_deadlines
  (obligation, entity_type, sector, period, due_date, nit_last_digit, nit_group, description, estatuto_article)
SELECT
  'Declaración de activos en el exterior',
  d.entity_type,
  d.sector,
  d.period,
  d.due_date,
  d.nit_last_digit,
  d.nit_group,
  'La fecha coincide con el vencimiento de renta del tipo de contribuyente indicado. Verifica si estás obligado a declarar.',
  'Art. 607 ET'
FROM public.tax_deadlines AS d
WHERE d.obligation IN (
  'Renta grandes contribuyentes · declaración y segunda cuota',
  'Renta personas jurídicas · declaración y segunda cuota',
  'Renta personas naturales',
  'Régimen Simple · declaración anual'
)
AND NOT EXISTS (
  SELECT 1 FROM public.tax_deadlines AS existing
  WHERE existing.obligation = 'Declaración de activos en el exterior'
    AND existing.period = d.period
    AND existing.due_date = d.due_date
    AND existing.nit_last_digit IS NOT DISTINCT FROM d.nit_last_digit
    AND existing.nit_group IS NOT DISTINCT FROM d.nit_group
);

COMMENT ON COLUMN public.tax_deadlines.nit_group IS
  'Grupo de terminación del NIT usado cuando el calendario oficial agrupa dos o más dígitos; no sustituye nit_last_digit.';
