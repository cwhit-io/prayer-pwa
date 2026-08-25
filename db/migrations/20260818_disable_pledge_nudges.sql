update notification_settings
set enabled = false,
    updated_at = now()
where notification_key = 'pledge_reminder';

update notification_delivery_queue
set status = 'cancelled',
    error_message = 'Disabled during capital campaign pledge migration'
where notification_key = 'pledge_reminder'
  and status = 'queued';

insert into schema_migrations (version)
values ('20260818_disable_pledge_nudges')
on conflict (version) do nothing;
