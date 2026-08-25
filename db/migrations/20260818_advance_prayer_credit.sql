alter table campaigns add column if not exists prayer_credit_starts_on date null;

update campaigns c
set prayer_credit_starts_on = least(
  c.starts_on,
  coalesce(
    (select min((s.started_at at time zone c.time_zone)::date) from prayer_sessions s),
    c.starts_on
  )
)
where c.prayer_credit_starts_on is null;

alter table campaigns alter column prayer_credit_starts_on set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'campaigns_credit_window_check') then
    alter table campaigns add constraint campaigns_credit_window_check
      check (prayer_credit_starts_on <= starts_on and prayer_credit_starts_on <= ends_on);
  end if;
end $$;

alter table prayer_sessions add column if not exists campaign_attribution text null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prayer_sessions_campaign_attribution_check') then
    alter table prayer_sessions add constraint prayer_sessions_campaign_attribution_check
      check (campaign_attribution is null or campaign_attribution in ('pre_campaign_credit', 'in_campaign'));
  end if;
end $$;

create or replace function assign_prayer_session_campaign()
returns trigger
language plpgsql
as $$
declare
  selected_campaign campaigns%rowtype;
begin
  if new.campaign_id is null then
    select c.* into selected_campaign
    from campaigns c
    where new.started_at >= c.prayer_credit_starts_on::timestamp at time zone c.time_zone
      and new.started_at < (c.ends_on + 1)::timestamp at time zone c.time_zone
    order by c.is_current desc, c.starts_on desc
    limit 1;
    new.campaign_id := selected_campaign.id;
  else
    select c.* into selected_campaign from campaigns c where c.id = new.campaign_id;
  end if;

  if selected_campaign.id is null then
    new.campaign_attribution := null;
  elsif new.started_at < selected_campaign.starts_on::timestamp at time zone selected_campaign.time_zone then
    new.campaign_attribution := 'pre_campaign_credit';
  else
    new.campaign_attribution := 'in_campaign';
  end if;
  return new;
end;
$$;

update prayer_sessions s
set campaign_id = c.id,
    campaign_attribution = case
      when s.started_at < c.starts_on::timestamp at time zone c.time_zone then 'pre_campaign_credit'
      else 'in_campaign'
    end
from campaigns c
where s.started_at >= c.prayer_credit_starts_on::timestamp at time zone c.time_zone
  and s.started_at < (c.ends_on + 1)::timestamp at time zone c.time_zone
  and (s.campaign_id is null or s.campaign_id = c.id);

create or replace function protect_campaign_accounting()
returns trigger
language plpgsql
as $$
begin
  if (new.prayer_credit_starts_on, new.starts_on, new.ends_on, new.time_zone, new.installment_count)
     is distinct from
     (old.prayer_credit_starts_on, old.starts_on, old.ends_on, old.time_zone, old.installment_count)
     and exists (select 1 from prayer_sessions where campaign_id = old.id)
  then
    raise exception 'Campaign credit window, dates, timezone, and installments cannot change after prayer has been recorded';
  end if;
  return new;
end;
$$;

insert into schema_migrations (version)
values ('20260818_advance_prayer_credit')
on conflict (version) do nothing;
