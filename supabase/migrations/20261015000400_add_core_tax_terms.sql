INSERT INTO public.tax_dictionary (term, definition, estatuto_article, sectors, entity_types)
SELECT additions.term, additions.definition, additions.estatuto_article, ARRAY['todos'], ARRAY['ambas']
FROM (VALUES
  ('UVT', 'Unidad de Valor Tributario: unidad de cuenta que se actualiza anualmente para expresar valores previstos en la legislación tributaria. Verifica el valor oficial aplicable al año gravable.', 'Art. 868 ET'),
  ('RST', 'Régimen Simple de Tributación: régimen opcional para determinar un impuesto unificado si se cumplen los requisitos legales. Sustituye el impuesto sobre la renta e integra componentes de ICA; el IVA se declara y paga por separado cuando se es responsable.', 'Arts. 903-916 ET'),
  ('Renta presuntiva', 'La renta presuntiva fue derogada para los años gravables desde 2021. No se debe usar como base mínima vigente para calcular el impuesto de renta.', 'Art. 188 ET; Ley 2010 de 2019'),
  ('IVA', 'Impuesto indirecto sobre las operaciones gravadas que define la ley. La tarifa depende del bien o servicio y la periodicidad de declaración depende de las condiciones legales del responsable.', 'Arts. 420, 468 y 600 ET')
) AS additions(term, definition, estatuto_article)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.tax_dictionary AS existing
  WHERE lower(existing.term) = lower(additions.term)
);
