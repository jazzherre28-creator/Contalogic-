UPDATE public.tax_dictionary
SET term = CASE
      WHEN term ~ '[ÃÂ]' THEN convert_from(convert_to(term, 'WIN1252'), 'UTF8')
      ELSE term
    END,
    definition = CASE
      WHEN definition ~ '[ÃÂ]' THEN convert_from(convert_to(definition, 'WIN1252'), 'UTF8')
      ELSE definition
    END,
    estatuto_article = CASE
      WHEN estatuto_article IS NULL THEN NULL
      WHEN estatuto_article ~ '[ÃÂ]' THEN convert_from(convert_to(estatuto_article, 'WIN1252'), 'UTF8')
      ELSE estatuto_article
    END
WHERE term ~ '[ÃÂ]'
   OR definition ~ '[ÃÂ]'
   OR COALESCE(estatuto_article, '') ~ '[ÃÂ]';

UPDATE public.tax_deadlines
SET obligation = CASE
      WHEN obligation ~ '[ÃÂ]' THEN convert_from(convert_to(obligation, 'WIN1252'), 'UTF8')
      ELSE obligation
    END,
    period = CASE
      WHEN period ~ '[ÃÂ]' THEN convert_from(convert_to(period, 'WIN1252'), 'UTF8')
      ELSE period
    END,
    description = CASE
      WHEN description IS NULL THEN NULL
      WHEN description ~ '[ÃÂ]' THEN convert_from(convert_to(description, 'WIN1252'), 'UTF8')
      ELSE description
    END,
    estatuto_article = CASE
      WHEN estatuto_article IS NULL THEN NULL
      WHEN estatuto_article ~ '[ÃÂ]' THEN convert_from(convert_to(estatuto_article, 'WIN1252'), 'UTF8')
      ELSE estatuto_article
    END
WHERE obligation ~ '[ÃÂ]'
   OR period ~ '[ÃÂ]'
   OR COALESCE(description, '') ~ '[ÃÂ]'
   OR COALESCE(estatuto_article, '') ~ '[ÃÂ]';
