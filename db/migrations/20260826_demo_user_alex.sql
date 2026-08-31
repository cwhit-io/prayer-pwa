-- Video demo account: Alex, phone 260-276-7404, fixed OTP 000000.
-- Temp: friends names and prayer log are wiped on logout (app code).

alter table app_users add column if not exists is_demo boolean not null default false;

-- Reuse the earlier explainer capture user if it is still around.
update app_users
set
  name = 'Alex',
  email = 'phone-12602767404@unlinked.local',
  role = 'member',
  is_demo = true,
  planning_center_person_id = null,
  planning_center_display_name = null,
  planning_center_linked_at = null,
  planning_center_sync_status = 'unlinked',
  planning_center_last_synced_at = null
where email = 'demo.explainer@unlinked.local'
  and not exists (
    select 1 from app_users where email = 'phone-12602767404@unlinked.local'
  );

insert into app_users (
  name,
  email,
  role,
  planning_center_sync_status,
  is_demo
)
values (
  'Alex',
  'phone-12602767404@unlinked.local',
  'member',
  'unlinked',
  true
)
on conflict (email) do update
set
  name = 'Alex',
  role = 'member',
  is_demo = true,
  planning_center_person_id = null,
  planning_center_display_name = null,
  planning_center_linked_at = null,
  planning_center_sync_status = 'unlinked',
  planning_center_last_synced_at = null;

-- This phone belongs only to the demo member.
delete from user_contact_methods
where type = 'phone'
  and value_normalized in ('+12602767404', '2602767404', '12602767404')
  and user_id <> (select id from app_users where email = 'phone-12602767404@unlinked.local');

insert into user_contact_methods (
  user_id,
  type,
  value_normalized,
  verified_at,
  planning_center_person_id
)
select
  id,
  'phone',
  '+12602767404',
  now(),
  null
from app_users
where email = 'phone-12602767404@unlinked.local'
on conflict (user_id, type, value_normalized) do update
set verified_at = now(),
    planning_center_person_id = null;

-- Start each filming session clean if leftover explainer data is on this user.
delete from prayer_friend_slots
where user_id in (select id from app_users where is_demo);
delete from prayer_sessions
where user_id in (select id from app_users where is_demo);
