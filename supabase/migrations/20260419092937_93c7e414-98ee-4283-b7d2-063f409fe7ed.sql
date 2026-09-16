-- Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  entity_type text CHECK (entity_type IN ('natural','juridica')),
  sector text CHECK (sector IN ('transporte','comercio','servicios','manufactura')),
  display_name text,
  onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Generic updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Financial records
CREATE TABLE public.financial_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  amount numeric NOT NULL,
  kind text NOT NULL CHECK (kind IN ('income','expense')),
  note text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fr_select_own" ON public.financial_records FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "fr_insert_own" ON public.financial_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fr_update_own" ON public.financial_records FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "fr_delete_own" ON public.financial_records FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX fr_user_time_idx ON public.financial_records (user_id, recorded_at DESC);

-- OCR documents
CREATE TABLE public.ocr_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('balance','pnl')),
  raw_text text,
  parsed_data jsonb,
  file_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ocr_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ocr_select_own" ON public.ocr_documents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ocr_insert_own" ON public.ocr_documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ocr_delete_own" ON public.ocr_documents FOR DELETE TO authenticated USING (auth.uid() = user_id);