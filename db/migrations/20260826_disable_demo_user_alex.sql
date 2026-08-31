-- Turn off the Alex filming account: no demo flag, kick open sessions.
update app_users
set is_demo = false
where email = 'phone-12602767404@unlinked.local'
   or is_demo;

delete from auth_sessions
where user_id in (
  select id from app_users where email = 'phone-12602767404@unlinked.local'
);
