-- Repair Word/Excel punctuation that was stored as U+FFFD (�) after a
-- Windows-1252 CSV was read as UTF-8. Same heuristics as src/lib/text.ts.

create or replace function repair_imported_text(input text)
returns text
language plpgsql
immutable
as $$
declare
  s text;
  result text := '';
  i int;
  len int;
  ch text;
  prev text;
  after_text text;
  nxt text;
begin
  if input is null or input = '' then
    return input;
  end if;

  s := input;
  s := replace(s, U&'\00E2\20AC\2122', U&'\2019');
  s := replace(s, U&'\00E2\20AC\02DC', U&'\2018');
  s := replace(s, U&'\00E2\20AC\0153', U&'\201C');
  s := replace(s, U&'\00E2\20AC\009D', U&'\201D');
  s := replace(s, U&'\00E2\20AC\201D', U&'\2014');
  s := replace(s, U&'\00E2\20AC\201C', U&'\2013');
  s := replace(s, U&'\00E2\20AC\00A6', U&'\2026');
  s := replace(s, U&'\00C2\00A0', U&'\00A0');

  s := replace(s, chr(128), U&'\20AC');
  s := replace(s, chr(130), U&'\201A');
  s := replace(s, chr(132), U&'\201E');
  s := replace(s, chr(133), U&'\2026');
  s := replace(s, chr(145), U&'\2018');
  s := replace(s, chr(146), U&'\2019');
  s := replace(s, chr(147), U&'\201C');
  s := replace(s, chr(148), U&'\201D');
  s := replace(s, chr(150), U&'\2013');
  s := replace(s, chr(151), U&'\2014');

  len := char_length(s);
  i := 1;
  while i <= len loop
    ch := substr(s, i, 1);
    if ch = chr(65533) then
      prev := case when i > 1 then substr(s, i - 1, 1) else '' end;
      after_text := substr(s, i + 1);
      nxt := substr(after_text, 1, 1);

      if prev ~ '[[:alpha:]]' and after_text ~ '^(s|t|d|m|ll|re|ve)([^[:alpha:]]|$)' then
        result := result || U&'\2019';
      elsif (i = 1 or prev ~ '[[:space:](\[{]' or substr(s, 1, i - 1) ~ '[,:;][[:space:]]*$')
            and coalesce(nxt, '') ~ '[[:alnum:]]' then
        result := result || U&'\201C';
      elsif prev ~ '[[:alnum:].!?]' and (after_text = '' or after_text ~ '^[[:space:].,;:!?)}\]]') then
        result := result || U&'\201D';
      elsif prev ~ '[[:alpha:]]' and nxt ~ '[[:alpha:]]' then
        result := result || U&'\2014';
      else
        result := result || U&'\2019';
      end if;
    else
      result := result || ch;
    end if;
    i := i + 1;
  end loop;

  return result;
end;
$$;

update prayer_prompts
set
  title = repair_imported_text(title),
  body = repair_imported_text(body),
  scripture_reference = repair_imported_text(scripture_reference),
  scripture_text = repair_imported_text(scripture_text)
where title like '%' || chr(65533) || '%'
   or body like '%' || chr(65533) || '%'
   or coalesce(scripture_reference, '') like '%' || chr(65533) || '%'
   or coalesce(scripture_text, '') like '%' || chr(65533) || '%';

update acts_prompts
set
  title = repair_imported_text(title),
  body = repair_imported_text(body),
  scripture_reference = repair_imported_text(scripture_reference),
  scripture_text = repair_imported_text(scripture_text)
where title like '%' || chr(65533) || '%'
   or body like '%' || chr(65533) || '%'
   or coalesce(scripture_reference, '') like '%' || chr(65533) || '%'
   or coalesce(scripture_text, '') like '%' || chr(65533) || '%';

drop function repair_imported_text(text);
