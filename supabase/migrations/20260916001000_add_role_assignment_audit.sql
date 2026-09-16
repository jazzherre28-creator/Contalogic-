-- Keep track of which super administrator assigned each role.
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
