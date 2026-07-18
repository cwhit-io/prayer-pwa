export const prayerSchemaSql = `
create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  role text not null default 'member',
  group_id uuid null,
  created_at timestamptz not null default now()
);

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'small_group',
  leader_user_id uuid null references app_users(id) on delete set null
);

create table if not exists pledges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  minutes_per_week integer not null check (minutes_per_week > 0),
  total_pledged_minutes integer not null,
  start_date date not null,
  end_date date null,
  prayer_focus text null,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

alter table pledges add column if not exists prayer_focus text null;

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
  user_id uuid null references app_users(id) on delete cascade,
  prompt_id uuid null references prayer_prompts(id) on delete set null,
  minutes integer not null check (minutes > 0),
  started_at timestamptz not null default now(),
  ended_at timestamptz not null default now(),
  entry_type text not null default 'timer',
  notes text null,
  created_at timestamptz not null default now()
);

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

insert into planning_center_field_map (field_key, label, direction, enabled, notes)
values
  ('prayer_progress', 'Prayer progress', 'write', false, 'Percent or minutes toward pledge'),
  ('last_prayed_for', 'Last prayed for', 'write', false, 'Timestamp of last prayer session for this person'),
  ('follow_up_needed', 'Follow-up needed', 'both', false, 'Boolean care flag for pastoral follow-up'),
  ('care_visit_scheduled', 'Care visit scheduled', 'both', false, 'Scheduled care visit date/time'),
  ('pastoral_care_notes', 'Pastoral care notes', 'write', false, 'Leader notes only — enable carefully')
on conflict (field_key) do nothing;

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
  updated_at timestamptz not null default now()
);
`;
