create table if not exists campaign_sends (
  id             uuid        default gen_random_uuid() primary key,
  lead_id        text        not null,
  email          text        not null,
  first_name     text,
  company        text,
  sequence_index int         not null,
  sent_at        timestamptz default now()
);

alter table campaign_sends enable row level security;

-- Service role can insert; anon can read aggregate view only (no PII)
create policy "service insert"
  on campaign_sends for insert with check (true);

-- Aggregate stats view — safe for anon reads (no email addresses)
create or replace view campaign_stats as
select
  count(distinct lead_id) filter (where sequence_index = 0) as email1_sent,
  count(distinct lead_id) filter (where sequence_index = 1) as email2_sent,
  count(distinct lead_id) filter (where sequence_index = 2) as email3_sent,
  (
    select count(*) from campaign_sends s2
    where s2.lead_id in (
      select lead_id from campaign_sends group by lead_id having count(*) >= 3
    ) and s2.sequence_index = 0
  ) as sequence_complete,
  count(*) filter (where sent_at::date = current_date) as sent_today,
  count(distinct lead_id) as total_contacted
from campaign_sends;

grant select on campaign_stats to anon;
