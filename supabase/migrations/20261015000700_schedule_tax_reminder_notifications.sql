CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'daily-tax-reminder-notifications'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'daily-tax-reminder-notifications',
    '0 12 * * *',
    $job$
      INSERT INTO public.notifications (user_id, title, body, kind, link, data)
      SELECT
        reminder.user_id,
        CASE reminder_window.days_left
          WHEN 1 THEN 'Vence mañana: ' || deadline.obligation
          ELSE 'Vence en 3 días: ' || deadline.obligation
        END,
        deadline.obligation || ' (' || deadline.period || ') vence el ' ||
          deadline.due_date::text ||
          CASE
            WHEN deadline.estatuto_article IS NOT NULL
              THEN '. Ref: ' || deadline.estatuto_article
            ELSE ''
          END,
        CASE reminder_window.days_left
          WHEN 1 THEN 'danger'
          ELSE 'warning'
        END,
        '/calendar',
        jsonb_build_object(
          'tag', 'deadline:' || deadline.id::text || ':d' || reminder_window.days_left::text,
          'deadline_id', deadline.id,
          'days_left', reminder_window.days_left
        )
      FROM public.user_reminders AS reminder
      JOIN public.tax_deadlines AS deadline
        ON deadline.id = reminder.deadline_id
      CROSS JOIN (VALUES (1), (3)) AS reminder_window(days_left)
      WHERE reminder.status = 'pending'
        AND deadline.due_date =
          (now() AT TIME ZONE 'America/Bogota')::date + reminder_window.days_left
        AND NOT EXISTS (
          SELECT 1
          FROM public.notifications AS existing_notification
          WHERE existing_notification.user_id = reminder.user_id
            AND existing_notification.data @> jsonb_build_object(
              'tag',
              'deadline:' || deadline.id::text || ':d' || reminder_window.days_left::text
            )
        );
    $job$
  );
END;
$$;
