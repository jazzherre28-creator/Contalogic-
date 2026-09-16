-- Notifications table for in-app bell
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  kind text NOT NULL DEFAULT 'info',
  link text,
  data jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_select_own" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "notif_super_admin_view" ON public.notifications
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "notif_update_own" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "notif_delete_own" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "notif_insert_service" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;