update app_users set role = 'member' where role = 'guest';

do $$
begin
  if exists (
    select 1 from app_users
    where role not in ('member', 'prayer_team', 'admin', 'superadmin')
  ) then
    raise exception 'Cannot constrain app_users.role: unsupported roles exist';
  end if;
end $$;

update app_users u
set role = 'superadmin'
where lower(u.email) in ('cwhitmer@blackhawkministries.org', 'kdwyer@blackhawkministries.org')
   or exists (
     select 1
     from user_contact_methods cm
     where cm.user_id = u.id
       and cm.verified_at is not null
       and lower(cm.value_normalized) in (
         'cwhitmer@blackhawkministries.org',
         'kdwyer@blackhawkministries.org'
       )
   );

do $$
begin
  if (
    select count(distinct u.id)
    from app_users u
    left join user_contact_methods cm
      on cm.user_id = u.id and cm.verified_at is not null
    where u.role = 'superadmin'
      and (
        lower(u.email) in ('cwhitmer@blackhawkministries.org', 'kdwyer@blackhawkministries.org')
        or lower(cm.value_normalized) in ('cwhitmer@blackhawkministries.org', 'kdwyer@blackhawkministries.org')
      )
  ) <> 2 then
    raise exception 'Both approved initial superadmin accounts must exist';
  end if;
end $$;

alter table app_users drop constraint if exists app_users_role_check;
alter table app_users add constraint app_users_role_check
  check (role in ('member', 'prayer_team', 'admin', 'superadmin'));

create table if not exists authorization_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null references app_users(id) on delete set null,
  target_user_id uuid null references app_users(id) on delete set null,
  prayer_request_id uuid null references prayer_requests(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_authorization_audit_log_created
  on authorization_audit_log (created_at desc);

create or replace function protect_final_superadmin()
returns trigger
language plpgsql
as $$
begin
  if old.role = 'superadmin'
     and (tg_op = 'DELETE' or new.role <> 'superadmin') then
    perform pg_advisory_xact_lock(hashtext('app_user_role_change'));
    if not exists (
      select 1 from app_users where role = 'superadmin' and id <> old.id
    ) then
      raise exception 'Cannot remove the final superadmin';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;

drop trigger if exists protect_final_superadmin_trigger on app_users;
create trigger protect_final_superadmin_trigger
before update of role or delete on app_users
for each row execute function protect_final_superadmin();
