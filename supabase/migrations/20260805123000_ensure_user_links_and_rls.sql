-- Ensure user links (user_id FKs) and RLS policies are present and idempotent

-- 1) Ensure user_id columns exist and FK constraints reference auth.users(id)
ALTER TABLE IF EXISTS public.financial_records
  ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE IF EXISTS public.ocr_documents
  ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE IF EXISTS public.notifications
  ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE IF EXISTS public.user_reminders
  ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE IF EXISTS public.user_roles
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- Add FK constraints only if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_finrec_user_id'
  ) THEN
    ALTER TABLE public.financial_records
      ADD CONSTRAINT fk_finrec_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ocr_user_id'
  ) THEN
    ALTER TABLE public.ocr_documents
      ADD CONSTRAINT fk_ocr_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_notif_user_id'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT fk_notif_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_rem_user_id'
  ) THEN
    ALTER TABLE public.user_reminders
      ADD CONSTRAINT fk_rem_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_roles_user_id'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT fk_roles_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END$$;

-- 2) Ensure RLS enabled and policies exist (idempotent drops + creates)
ALTER TABLE IF EXISTS public.financial_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fr_select_own" ON public.financial_records;
DROP POLICY IF EXISTS "fr_insert_own" ON public.financial_records;
DROP POLICY IF EXISTS "fr_update_own" ON public.financial_records;
DROP POLICY IF EXISTS "fr_delete_own" ON public.financial_records;
CREATE POLICY "fr_select_own" ON public.financial_records FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "fr_insert_own" ON public.financial_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fr_update_own" ON public.financial_records FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "fr_delete_own" ON public.financial_records FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE IF EXISTS public.ocr_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ocr_select_own" ON public.ocr_documents;
DROP POLICY IF EXISTS "ocr_insert_own" ON public.ocr_documents;
DROP POLICY IF EXISTS "ocr_delete_own" ON public.ocr_documents;
CREATE POLICY "ocr_select_own" ON public.ocr_documents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ocr_insert_own" ON public.ocr_documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ocr_delete_own" ON public.ocr_documents FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;
DROP POLICY IF EXISTS "notif_delete_own" ON public.notifications;
DROP POLICY IF EXISTS "notif_insert_service" ON public.notifications;
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notif_delete_own" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
-- allow inserts by the same user (clients inserting their own notifications) and server/service via has_role if needed
CREATE POLICY "notif_insert_service" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

ALTER TABLE IF EXISTS public.user_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rem_select_own" ON public.user_reminders;
DROP POLICY IF EXISTS "rem_insert_own" ON public.user_reminders;
DROP POLICY IF EXISTS "rem_update_own" ON public.user_reminders;
DROP POLICY IF EXISTS "rem_delete_own" ON public.user_reminders;
CREATE POLICY "rem_select_own" ON public.user_reminders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "rem_insert_own" ON public.user_reminders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rem_update_own" ON public.user_reminders FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "rem_delete_own" ON public.user_reminders FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE IF EXISTS public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_view_own_roles" ON public.user_roles;
DROP POLICY IF EXISTS "super_admin_view_all_roles" ON public.user_roles;
DROP POLICY IF EXISTS "super_admin_insert_roles" ON public.user_roles;
DROP POLICY IF EXISTS "super_admin_delete_roles" ON public.user_roles;
CREATE POLICY "users_view_own_roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "super_admin_view_all_roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "super_admin_insert_roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "super_admin_delete_roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- 3) Ensure profile auto-creation trigger exists (idempotent)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4) Ensure user_roles auto-assignment trigger exists (idempotent)
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email = 'jazzherre28@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin') ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- 5) Backfill missing user_id for existing records where possible
-- For rows that have an identifiable email in related tables, you could backfill using joins to auth.users by email. This is environment-specific; below is a safe template that only runs when matching email columns exist.

-- Example (commented out):
-- UPDATE public.notifications n
-- SET user_id = u.id
-- FROM auth.users u
-- WHERE n.user_id IS NULL AND n.data->>'email' = u.email;

-- End of migration
