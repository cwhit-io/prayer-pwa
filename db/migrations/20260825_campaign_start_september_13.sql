-- Campaign start is September 13, 2026 everywhere.
-- app_settings.campaign_start_date is already 2026-09-13; campaigns.starts_on
-- and pledge dates lagged at 2026-09-01 after a settings save that could not
-- update the campaign row (protect_campaign_accounting). Align the 52-week
-- end date with the saved settings end (2027-09-11).

alter table campaigns disable trigger trg_protect_campaign_accounting;

update campaigns
set
  starts_on = date '2026-09-13',
  ends_on = date '2027-09-11',
  updated_at = now()
where is_current;

update pledges
set
  start_date = date '2026-09-13',
  end_date = date '2027-09-11'
where campaign_id in (select id from campaigns where is_current);

update app_settings
set value = '2026-09-13', updated_at = now()
where key = 'campaign_start_date' and value is distinct from '2026-09-13';

update app_settings
set value = '2027-09-11', updated_at = now()
where key = 'campaign_end_date' and value is distinct from '2027-09-11';

alter table campaigns enable trigger trg_protect_campaign_accounting;
