CREATE OR REPLACE FUNCTION public.prevent_support_account_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND lower(trim(OLD.email)) = 'jazzherre28@gmail.com' THEN
    RAISE EXCEPTION 'La cuenta de soporte está protegida y no se puede eliminar.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF TG_OP = 'UPDATE'
     AND lower(trim(OLD.email)) = 'jazzherre28@gmail.com'
     AND lower(trim(NEW.email)) IS DISTINCT FROM 'jazzherre28@gmail.com' THEN
    RAISE EXCEPTION 'El correo de la cuenta de soporte no se puede cambiar.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_support_auth_user ON auth.users;
CREATE TRIGGER protect_support_auth_user
  BEFORE DELETE OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_support_account_removal();

CREATE OR REPLACE FUNCTION public.prevent_support_role_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  protected_user_id uuid;
BEGIN
  SELECT id
  INTO protected_user_id
  FROM auth.users
  WHERE lower(trim(email)) = 'jazzherre28@gmail.com';

  IF TG_OP = 'DELETE' AND OLD.user_id = protected_user_id THEN
    RAISE EXCEPTION 'No se pueden quitar roles a la cuenta de soporte.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF TG_OP = 'UPDATE'
     AND (OLD.user_id = protected_user_id OR NEW.user_id = protected_user_id) THEN
    RAISE EXCEPTION 'No se pueden cambiar los roles de la cuenta de soporte.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_support_user_roles ON public.user_roles;
CREATE TRIGGER protect_support_user_roles
  BEFORE DELETE OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_support_role_removal();

CREATE OR REPLACE FUNCTION public.prevent_support_profile_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = OLD.id
      AND lower(trim(email)) = 'jazzherre28@gmail.com'
  ) THEN
    RAISE EXCEPTION 'El perfil de la cuenta de soporte está protegido.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS protect_support_profile ON public.profiles;
CREATE TRIGGER protect_support_profile
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_support_profile_removal();

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role
FROM auth.users
WHERE lower(trim(email)) = 'jazzherre28@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(trim(email)) = 'jazzherre28@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
