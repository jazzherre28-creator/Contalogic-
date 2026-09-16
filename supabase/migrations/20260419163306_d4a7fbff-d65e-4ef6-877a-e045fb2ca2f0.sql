-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'user');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer function to check roles (no recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. RLS policies on user_roles
CREATE POLICY "users_view_own_roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "super_admin_view_all_roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "super_admin_insert_roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "super_admin_delete_roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  -- Prevent removing the last super_admin
  AND NOT (
    role = 'super_admin'
    AND (SELECT COUNT(*) FROM public.user_roles WHERE role = 'super_admin') <= 1
  )
);

-- 5. Extend RLS on profiles, financial_records, ocr_documents for super_admin
CREATE POLICY "super_admin_view_all_profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "super_admin_view_all_financial"
ON public.financial_records FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "super_admin_view_all_ocr"
ON public.ocr_documents FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- 6. Auto-assign super_admin to specific email on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'jazzherre28@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- 7. Backfill: assign super_admin to existing jazzherre28@gmail.com user if exists
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role
FROM auth.users
WHERE email = 'jazzherre28@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 8. Backfill 'user' role for existing users without roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user'::public.app_role
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_roles)
ON CONFLICT (user_id, role) DO NOTHING;