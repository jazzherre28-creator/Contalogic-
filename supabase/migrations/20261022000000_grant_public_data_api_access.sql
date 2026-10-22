-- Keep Data API grants scoped; grant future tables in the migrations that create them.
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.financial_records, public.ocr_documents,
     public.user_reminders, public.notifications, public.transport_trips
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.tax_dictionary, public.tax_deadlines,
     public.economic_indicators
  TO authenticated;

GRANT ALL PRIVILEGES
  ON TABLE public.profiles, public.user_roles, public.financial_records,
     public.ocr_documents, public.tax_dictionary, public.tax_deadlines,
     public.economic_indicators, public.user_reminders, public.notifications,
     public.transport_trips
  TO service_role;
