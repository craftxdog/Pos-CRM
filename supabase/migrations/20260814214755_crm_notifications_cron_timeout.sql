-- pg_net defaults to five seconds, which is too short for a tenant-scoped
-- notification run that may contact SMTP and WhatsApp providers. Recreate the
-- daily job with a bounded 30-second request timeout; the Edge Function still
-- has its own retry and per-run limits.
do $block$
declare
  existing_job bigint;
begin
  for existing_job in
    select jobid from cron.job where jobname = 'crm-notifications-daily'
  loop
    perform cron.unschedule(existing_job);
  end loop;
end;
$block$;

select cron.schedule(
  'crm-notifications-daily',
  '0 13 * * *',
  $cron$
    select net.http_post(
      url := 'https://cqnfziultbkobdkegtfm.supabase.co/functions/v1/crm-notifications-run',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-CRM-Cron-Secret', (
          select secret.decrypted_secret
          from vault.decrypted_secrets secret
          where secret.name = 'crm_notifications_cron_secret'
          limit 1
        )
      ),
      body := jsonb_build_object('source', 'pg_cron'),
      timeout_milliseconds := 30000
    ) as request_id;
  $cron$
);
