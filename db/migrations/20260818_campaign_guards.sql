create or replace function protect_campaign_accounting()
returns trigger
language plpgsql
as $$
begin
  if (new.starts_on, new.ends_on, new.time_zone, new.installment_count)
     is distinct from
     (old.starts_on, old.ends_on, old.time_zone, old.installment_count)
     and exists (select 1 from prayer_sessions where campaign_id = old.id)
  then
    raise exception 'Campaign dates, timezone, and installments cannot change after prayer has been recorded';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_campaign_accounting on campaigns;
create trigger trg_protect_campaign_accounting
before update on campaigns
for each row execute function protect_campaign_accounting();

create or replace function validate_pledge_rate_installment()
returns trigger
language plpgsql
as $$
declare
  allowed_installments integer;
begin
  select c.installment_count into allowed_installments
  from pledges p
  join campaigns c on c.id = p.campaign_id
  where p.id = new.pledge_id;

  if allowed_installments is null or new.effective_installment > allowed_installments then
    raise exception 'Pledge rate installment % is outside the campaign schedule', new.effective_installment;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_pledge_rate_installment on pledge_rate_history;
create trigger trg_validate_pledge_rate_installment
before insert or update on pledge_rate_history
for each row execute function validate_pledge_rate_installment();

insert into schema_migrations (version)
values ('20260818_campaign_guards')
on conflict (version) do nothing;
