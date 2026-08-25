create table if not exists schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  time_zone text not null default 'America/Indiana/Indianapolis',
  starts_on date not null,
  ends_on date not null,
  goal_minutes integer not null check (goal_minutes > 0),
  installment_count integer not null default 52 check (installment_count > 0),
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create unique index if not exists idx_campaigns_one_current
  on campaigns (is_current) where is_current;

insert into campaigns (slug, name, starts_on, ends_on, goal_minutes, installment_count, is_current)
select
  'pray-like-crazy-2026',
  'Pray Like Crazy 2026-2027',
  max(value::date) filter (where key = 'campaign_start_date'),
  max(value::date) filter (where key = 'campaign_end_date'),
  max(value::integer) filter (where key = 'campaign_goal_minutes'),
  52,
  true
from app_settings
where key in ('campaign_start_date', 'campaign_end_date', 'campaign_goal_minutes')
having max(value) filter (where key = 'campaign_start_date') <> ''
   and max(value) filter (where key = 'campaign_end_date') <> ''
on conflict (slug) do update
set name = excluded.name,
    starts_on = excluded.starts_on,
    ends_on = excluded.ends_on,
    goal_minutes = excluded.goal_minutes,
    installment_count = excluded.installment_count,
    is_current = true,
    updated_at = now();

do $$
begin
  if not exists (select 1 from campaigns where is_current) then
    raise exception 'A dated current campaign is required before migrating pledges';
  end if;
end $$;

alter table pledges add column if not exists campaign_id uuid null references campaigns(id) on delete restrict;
alter table pledges add column if not exists committed_minutes integer null;
alter table pledges add column if not exists joined_at timestamptz null;
alter table pledges add column if not exists withdrawn_at timestamptz null;

update pledges p
set campaign_id = c.id,
    committed_minutes = p.minutes_per_week * c.installment_count,
    total_pledged_minutes = p.minutes_per_week * c.installment_count,
    start_date = c.starts_on,
    end_date = c.ends_on,
    joined_at = coalesce(p.joined_at, p.created_at)
from campaigns c
where c.is_current
  and p.campaign_id is null;

alter table pledges alter column campaign_id set not null;
alter table pledges alter column committed_minutes set not null;
alter table pledges alter column joined_at set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pledges_committed_minutes_check') then
    alter table pledges add constraint pledges_committed_minutes_check check (committed_minutes >= 0);
  end if;
end $$;

create unique index if not exists idx_pledges_campaign_user
  on pledges (campaign_id, user_id);
create index if not exists idx_pledges_campaign_public
  on pledges (campaign_id, is_public) where withdrawn_at is null;

create table if not exists pledge_rate_history (
  id uuid primary key default gen_random_uuid(),
  pledge_id uuid not null references pledges(id) on delete cascade,
  effective_installment integer not null check (effective_installment >= 0),
  minutes_per_week integer not null check (minutes_per_week >= 0 and minutes_per_week <= 10080),
  created_at timestamptz not null default now(),
  unique (pledge_id, effective_installment)
);

create index if not exists idx_pledge_rate_history_lookup
  on pledge_rate_history (pledge_id, effective_installment desc);

insert into pledge_rate_history (pledge_id, effective_installment, minutes_per_week, created_at)
select p.id, 0, p.minutes_per_week, p.joined_at
from pledges p
on conflict (pledge_id, effective_installment) do nothing;

alter table prayer_sessions add column if not exists campaign_id uuid null references campaigns(id) on delete restrict;
create index if not exists idx_prayer_sessions_campaign_started
  on prayer_sessions (campaign_id, started_at);
create index if not exists idx_prayer_sessions_campaign_user_started
  on prayer_sessions (campaign_id, user_id, started_at);

create or replace function assign_prayer_session_campaign()
returns trigger
language plpgsql
as $$
begin
  if new.campaign_id is null then
    select c.id into new.campaign_id
    from campaigns c
    where new.started_at >= c.starts_on::timestamp at time zone c.time_zone
      and new.started_at < (c.ends_on + 1)::timestamp at time zone c.time_zone
    order by c.is_current desc, c.starts_on desc
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_prayer_session_campaign on prayer_sessions;
create trigger trg_assign_prayer_session_campaign
before insert or update of started_at, campaign_id on prayer_sessions
for each row execute function assign_prayer_session_campaign();

update prayer_sessions s
set campaign_id = c.id
from campaigns c
where s.campaign_id is null
  and s.started_at >= c.starts_on::timestamp at time zone c.time_zone
  and s.started_at < (c.ends_on + 1)::timestamp at time zone c.time_zone;

insert into schema_migrations (version)
values ('20260818_capital_campaign')
on conflict (version) do nothing;
