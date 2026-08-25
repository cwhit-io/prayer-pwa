export const prayerSchemaSql = `
create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  role text not null default 'member' check (role in ('member', 'prayer_team', 'admin', 'superadmin')),
  group_id uuid null,
  created_at timestamptz not null default now()
);

alter table app_users add column if not exists first_seen_at timestamptz null;
alter table app_users add column if not exists last_seen_at timestamptz null;

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'small_group',
  leader_user_id uuid null references app_users(id) on delete set null
);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  time_zone text not null default 'America/Indiana/Indianapolis',
  prayer_credit_starts_on date not null,
  starts_on date not null,
  ends_on date not null,
  goal_minutes integer not null check (goal_minutes > 0),
  installment_count integer not null default 52 check (installment_count > 0),
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (prayer_credit_starts_on <= starts_on)
);

create unique index if not exists idx_campaigns_one_current on campaigns (is_current) where is_current;

create table if not exists pledges (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete restrict,
  user_id uuid not null references app_users(id) on delete cascade,
  minutes_per_week integer not null check (minutes_per_week > 0),
  total_pledged_minutes integer not null,
  committed_minutes integer not null check (committed_minutes >= 0),
  start_date date not null,
  end_date date null,
  prayer_focus text null,
  is_public boolean not null default true,
  joined_at timestamptz not null default now(),
  withdrawn_at timestamptz null,
  created_at timestamptz not null default now()
);

alter table pledges add column if not exists prayer_focus text null;
alter table pledges add column if not exists campaign_id uuid null references campaigns(id) on delete restrict;
alter table pledges add column if not exists committed_minutes integer null;
alter table pledges add column if not exists joined_at timestamptz null;
alter table pledges add column if not exists withdrawn_at timestamptz null;
create unique index if not exists idx_pledges_campaign_user on pledges(campaign_id, user_id);

create table if not exists pledge_rate_history (
  id uuid primary key default gen_random_uuid(),
  pledge_id uuid not null references pledges(id) on delete cascade,
  effective_installment integer not null check (effective_installment >= 0),
  minutes_per_week integer not null check (minutes_per_week >= 0 and minutes_per_week <= 10080),
  created_at timestamptz not null default now(),
  unique (pledge_id, effective_installment)
);

create index if not exists idx_pledge_rate_history_lookup on pledge_rate_history(pledge_id, effective_installment desc);

create or replace function validate_pledge_rate_installment()
returns trigger
language plpgsql
as $$
declare
  allowed_installments integer;
begin
  select c.installment_count into allowed_installments
  from pledges p join campaigns c on c.id = p.campaign_id
  where p.id = new.pledge_id;
  if allowed_installments is null or new.effective_installment > allowed_installments then
    raise exception 'Pledge rate installment is outside the campaign schedule';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_pledge_rate_installment on pledge_rate_history;
create trigger trg_validate_pledge_rate_installment before insert or update on pledge_rate_history
for each row execute function validate_pledge_rate_installment();

create table if not exists prayer_prompts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  scripture_reference text null,
  scripture_text text null,
  body text not null,
  category text not null,
  suggested_minutes integer not null default 10,
  publish_date date not null default current_date,
  is_active boolean not null default true,
  created_by uuid null references app_users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table prayer_prompts add column if not exists created_at timestamptz not null default now();

create table if not exists prayer_sessions (
  id uuid primary key default gen_random_uuid(),
  client_session_id uuid null,
  campaign_id uuid null references campaigns(id) on delete restrict,
  campaign_attribution text null check (campaign_attribution is null or campaign_attribution in ('pre_campaign_credit', 'in_campaign')),
  user_id uuid null references app_users(id) on delete cascade,
  prompt_id uuid null references prayer_prompts(id) on delete set null,
  focus_label text null,
  minutes integer not null check (minutes > 0),
  started_at timestamptz not null default now(),
  ended_at timestamptz not null default now(),
  entry_type text not null default 'timer',
  notes text null,
  created_at timestamptz not null default now()
);

alter table prayer_sessions add column if not exists focus_label text null;
alter table prayer_sessions add column if not exists client_session_id uuid null;
alter table prayer_sessions add column if not exists campaign_id uuid null references campaigns(id) on delete restrict;
alter table prayer_sessions add column if not exists campaign_attribution text null;
create unique index if not exists idx_prayer_sessions_client_session on prayer_sessions(client_session_id);
create index if not exists idx_prayer_sessions_campaign_started on prayer_sessions(campaign_id, started_at);
create index if not exists idx_prayer_sessions_campaign_user_started on prayer_sessions(campaign_id, user_id, started_at);

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

drop trigger if exists trg_assign_prayer_session_campaign on prayer_sessions;
create trigger trg_assign_prayer_session_campaign
before insert or update of started_at, campaign_id on prayer_sessions
for each row execute function assign_prayer_session_campaign();

create or replace function protect_campaign_accounting()
returns trigger
language plpgsql
as $$
begin
  if (new.prayer_credit_starts_on, new.starts_on, new.ends_on, new.time_zone, new.installment_count)
     is distinct from (old.prayer_credit_starts_on, old.starts_on, old.ends_on, old.time_zone, old.installment_count)
     and exists (select 1 from prayer_sessions where campaign_id = old.id)
  then
    raise exception 'Campaign accounting fields cannot change after prayer has been recorded';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_campaign_accounting on campaigns;
create trigger trg_protect_campaign_accounting before update on campaigns
for each row execute function protect_campaign_accounting();

create table if not exists prayer_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references app_users(id) on delete set null,
  title text not null,
  body text not null,
  category text not null,
  visibility text not null,
  status text not null default 'open',
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  answered_at timestamptz null
);

alter table prayer_sessions add column if not exists request_id uuid references prayer_requests(id) on delete set null;
create index if not exists idx_prayer_sessions_request on prayer_sessions(request_id);

create table if not exists testimonies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references app_users(id) on delete set null,
  prayer_request_id uuid null references prayer_requests(id) on delete set null,
  title text not null,
  story text not null,
  approved boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists milestones (
  id uuid primary key default gen_random_uuid(),
  minutes_goal integer not null check (minutes_goal > 0),
  title text not null,
  message text not null,
  reached_at timestamptz null
);

create table if not exists auth_sessions (
  token text primary key,
  user_id uuid not null references app_users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table app_users add column if not exists planning_center_person_id text null;
alter table app_users add column if not exists planning_center_display_name text null;
alter table app_users add column if not exists planning_center_linked_at timestamptz null;
alter table app_users add column if not exists planning_center_sync_status text not null default 'unlinked';
alter table app_users add column if not exists planning_center_last_synced_at timestamptz null;
alter table app_users add column if not exists planning_center_campus_name text null;

create unique index if not exists idx_app_users_pc_person_id
  on app_users (planning_center_person_id)
  where planning_center_person_id is not null;

create table if not exists user_contact_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  type text not null check (type in ('email', 'phone')),
  value_normalized text not null,
  verified_at timestamptz not null default now(),
  planning_center_person_id text null,
  created_at timestamptz not null default now(),
  unique (user_id, type, value_normalized)
);

create index if not exists idx_user_contact_methods_value
  on user_contact_methods (type, value_normalized);

create table if not exists login_challenges (
  id uuid primary key default gen_random_uuid(),
  destination_type text not null check (destination_type in ('email', 'phone')),
  destination_normalized text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  verified_at timestamptz null,
  consumed_at timestamptz null,
  attempt_count integer not null default 0,
  candidate_people jsonb not null default '[]'::jsonb,
  debug_code text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_login_challenges_destination
  on login_challenges (destination_type, destination_normalized, created_at desc);

create table if not exists planning_center_people_cache (
  planning_center_person_id text primary key,
  name text not null,
  first_name text null,
  last_name text null,
  primary_email text null,
  primary_phone text null,
  household_ids jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null default now()
);

create table if not exists planning_center_households_cache (
  planning_center_household_id text primary key,
  name text not null,
  primary_contact_person_id text null,
  members jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null default now()
);

alter table groups add column if not exists planning_center_group_id text null;
alter table groups add column if not exists campus_name text null;
alter table groups add column if not exists created_at timestamptz not null default now();

create unique index if not exists idx_groups_pc_group_id
  on groups (planning_center_group_id)
  where planning_center_group_id is not null;

create table if not exists group_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  role text not null default 'member',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, group_id)
);

alter table prayer_requests add column if not exists target_group_id uuid null references groups(id) on delete set null;
alter table prayer_requests add column if not exists routing_queue text not null default 'prayer_team';
alter table prayer_requests add column if not exists verified_anonymous boolean not null default false;

create table if not exists planning_center_field_map (
  id uuid primary key default gen_random_uuid(),
  field_key text not null unique,
  planning_center_field_id text null,
  label text not null,
  direction text not null default 'write',
  enabled boolean not null default false,
  notes text null,
  created_at timestamptz not null default now()
);

create table if not exists planning_center_sync_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references app_users(id) on delete set null,
  field_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  error_message text null,
  created_at timestamptz not null default now(),
  processed_at timestamptz null
);

create index if not exists idx_prayer_sessions_user_started_at on prayer_sessions (user_id, started_at desc);
create index if not exists idx_pledges_user_created_at on pledges (user_id, created_at desc);
create index if not exists idx_auth_sessions_user_id on auth_sessions (user_id);
create index if not exists idx_prayer_prompts_publish_date on prayer_prompts (publish_date desc, is_active);
create index if not exists idx_prayer_requests_status_created_at on prayer_requests (status, created_at desc);
create index if not exists idx_prayer_requests_user_created_at on prayer_requests (user_id, created_at desc);
create index if not exists idx_prayer_requests_routing_queue on prayer_requests (routing_queue, status, created_at desc);
create index if not exists idx_prayer_requests_target_group on prayer_requests (target_group_id, status, created_at desc);
create index if not exists idx_testimonies_approved_featured on testimonies (approved, featured, created_at desc);
create index if not exists idx_group_memberships_user on group_memberships (user_id);
create index if not exists idx_group_memberships_group on group_memberships (group_id);
create index if not exists idx_pc_sync_queue_status on planning_center_sync_queue (status, created_at);

insert into planning_center_field_map (field_key, planning_center_field_id, label, direction, enabled, notes)
values
  (
    'total_minutes_pledged',
    '1091023',
    'Total Minutes Pledged',
    'write',
    true,
    'Current campaign commitment. PCO FieldDefinition 1091023 (Church Center tab 263994).'
  ),
  (
    'total_minutes_prayed',
    '1091024',
    'Total Minutes Prayed',
    'write',
    true,
    'Current campaign prayer actual. PCO FieldDefinition 1091024 (Church Center tab 263994).'
  )
on conflict (field_key) do nothing;

delete from planning_center_field_map
where field_key in (
  'prayer_progress',
  'last_prayed_for',
  'follow_up_needed',
  'care_visit_scheduled',
  'pastoral_care_notes'
);

create table if not exists notification_definitions (
  key text primary key,
  label text not null,
  description text not null,
  category text not null,
  supports_email boolean not null default true,
  supports_sms boolean not null default true,
  default_frequency text not null default 'manual',
  default_audience text not null default 'members',
  is_system boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists notification_settings (
  notification_key text primary key references notification_definitions(key) on delete cascade,
  enabled boolean not null default false,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  frequency text not null default 'weekly',
  send_day_of_week integer null,
  send_hour_local integer not null default 9,
  audience text not null default 'members',
  updated_at timestamptz not null default now()
);

create table if not exists notification_templates (
  notification_key text primary key references notification_definitions(key) on delete cascade,
  email_subject text not null default '',
  email_text text not null default '',
  email_html text not null default '',
  sms_body text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists notification_send_log (
  id uuid primary key default gen_random_uuid(),
  notification_key text not null,
  channel text not null,
  recipient text not null,
  subject text null,
  status text not null,
  error_message text null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_notification_send_log_created
  on notification_send_log (created_at desc);

create index if not exists idx_notification_send_log_key
  on notification_send_log (notification_key, created_at desc);

create table if not exists user_notification_preferences (
  user_id uuid primary key references app_users(id) on delete cascade,
  email_prayer_request_updates boolean not null default false,
  email_pledge_invitations boolean not null default false,
  email_progress_updates boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table user_notification_preferences
  add column if not exists email_pledge_invitations boolean not null default false;
alter table user_notification_preferences
  alter column email_pledge_invitations set default false;
alter table user_notification_preferences
  add column if not exists email_progress_updates boolean not null default false;

create table if not exists notification_delivery_queue (
  id uuid primary key default gen_random_uuid(),
  notification_key text not null references notification_definitions(key) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  recipient_email text not null,
  slot_key text not null,
  template_vars jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'processing', 'sent', 'failed', 'cancelled')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  provider_message_id text null,
  error_message text null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz null,
  sent_at timestamptz null,
  unique (notification_key, user_id, slot_key)
);

create index if not exists idx_notification_delivery_queue_ready
  on notification_delivery_queue (next_attempt_at, created_at)
  where status = 'queued';
`;
