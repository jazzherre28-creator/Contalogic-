-- The legacy trigger duplicates profile and role creation and causes signup
-- to fail on the unique constraints when the idempotent triggers also run.
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
