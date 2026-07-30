-- Litigation Intelligence outreach console schema
-- Project: bosvbnjhsimqtnwkkcvn (shared with the Ignite campaign)
-- Additive only. Nothing here touches leads, campaign_sends, call_tracker,
-- email_opens or unsubscribes.
--
-- Security model: Supabase Auth, single operator, RLS keyed on auth.uid().
-- The anon key must return nothing from every lit_ table. There is no
-- password gate and no service-role key in any published page.

-- ── lit_targets ──────────────────────────────────────────────────────────────
create table if not exists public.lit_targets (
  id                 uuid primary key default gen_random_uuid(),
  email              text not null,
  email_normalised   text generated always as (lower(btrim(email))) stored,
  name               text not null,
  first_name         text,
  firm               text,
  role               text,
  tier               text not null default 'W3',
  match_signal       text,
  messages_exchanged integer,
  last_contact_date  date,
  matter_context     text,
  phone              text,
  linkedin_url       text,
  source_url         text,
  subscriber_class   text,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint lit_targets_tier_check
    check (tier in ('W1','W2','W3','C')),
  constraint lit_targets_subscriber_class_check
    check (subscriber_class is null
           or subscriber_class in ('corporate','sole_trader','partnership','individual'))
);

create unique index if not exists lit_targets_email_normalised_key
  on public.lit_targets (email_normalised);

comment on column public.lit_targets.email_normalised is
  'Lowercased and trimmed email. The import script matches on this so a rerun updates rather than duplicates.';
comment on column public.lit_targets.source_url is
  'Provenance. Null for warm contacts sourced from Samuel own archive, required for every cold row.';
comment on column public.lit_targets.subscriber_class is
  'PECR classification. Left null until session 05 defines the rules.';

-- ── lit_tracker ──────────────────────────────────────────────────────────────
-- One row per target. Modelled on call_tracker, with the status list from
-- section 8 of warm-messages.md.
create table if not exists public.lit_tracker (
  target_id            uuid primary key
                       references public.lit_targets(id) on delete cascade,
  status               text not null default 'not_contacted',
  channel              text,
  manual_email_sent_at timestamptz,
  followup_sent_at     timestamptz,
  linkedin_sent_at     timestamptz,
  whatsapp_sent_at     timestamptz,
  called_at            timestamptz,
  last_contacted_at    timestamptz,
  next_action_at       timestamptz,
  notes                text,
  updated_at           timestamptz not null default now(),
  constraint lit_tracker_status_check
    check (status in ('not_contacted','on_hold','contacted','replied',
                      'call_booked','referred_on','not_interested','do_not_contact')),
  constraint lit_tracker_channel_check
    check (channel is null or channel in ('email','linkedin','whatsapp'))
);

create index if not exists lit_tracker_status_idx on public.lit_tracker (status);
create index if not exists lit_tracker_next_action_idx on public.lit_tracker (next_action_at);

comment on column public.lit_tracker.next_action_at is
  'Derived, never set by hand. Seven days after last_contacted_at while status is contacted and no follow-up has gone out. This drives the follow-up queue.';

-- ── lit_suppression ──────────────────────────────────────────────────────────
-- Permanent do-not-contact. Never auto-clears, never cascades from a delete.
create table if not exists public.lit_suppression (
  id               uuid primary key default gen_random_uuid(),
  email            text not null,
  email_normalised text generated always as (lower(btrim(email))) stored,
  reason           text,
  created_at       timestamptz not null default now()
);

create unique index if not exists lit_suppression_email_normalised_key
  on public.lit_suppression (email_normalised);

-- ── derived fields and updated_at ────────────────────────────────────────────
create or replace function public.lit_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.lit_tracker_derive()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();

  -- next_action_at is the only derived field. A contact who has been messaged
  -- and has not replied is due a follow-up seven days later. Once the follow-up
  -- has gone out there is no second one, so the field clears.
  if new.status = 'contacted'
     and new.last_contacted_at is not null
     and new.followup_sent_at is null then
    new.next_action_at := new.last_contacted_at + interval '7 days';
  else
    new.next_action_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists lit_targets_touch on public.lit_targets;
create trigger lit_targets_touch
  before update on public.lit_targets
  for each row execute function public.lit_touch_updated_at();

drop trigger if exists lit_tracker_derive_trg on public.lit_tracker;
create trigger lit_tracker_derive_trg
  before insert or update on public.lit_tracker
  for each row execute function public.lit_tracker_derive();

-- ── Row level security ───────────────────────────────────────────────────────
-- Every policy is keyed on auth.uid(). A request carrying only the anon key has
-- no auth.uid(), matches no policy, and reads nothing.
--
-- The uid is pinned to one account rather than tested for merely being present.
-- This Supabase project is shared, it already holds several unrelated auth
-- users, and sign-up on the anon key would otherwise be a way in. One operator,
-- one uid, everybody else reads nothing.
create or replace function public.lit_console_operator()
returns uuid
language sql
immutable
security invoker
set search_path = ''
as $$
  -- samuel@elamaconsulting.com. Change this and every lit_ policy follows.
  select '5f27389e-a7be-43bc-86de-7883573d7be4'::uuid;
$$;

comment on function public.lit_console_operator() is
  'The single account permitted to read the lit_ tables. Referenced by every lit_ RLS policy so the operator can be changed in one place.';

alter table public.lit_targets     enable row level security;
alter table public.lit_tracker     enable row level security;
alter table public.lit_suppression enable row level security;

alter table public.lit_targets     force row level security;
alter table public.lit_tracker     force row level security;
alter table public.lit_suppression force row level security;

drop policy if exists lit_targets_authenticated_all     on public.lit_targets;
drop policy if exists lit_tracker_authenticated_all     on public.lit_tracker;
drop policy if exists lit_suppression_authenticated_all on public.lit_suppression;

create policy lit_targets_authenticated_all
  on public.lit_targets
  for all
  to authenticated
  using ((select auth.uid()) = public.lit_console_operator())
  with check ((select auth.uid()) = public.lit_console_operator());

create policy lit_tracker_authenticated_all
  on public.lit_tracker
  for all
  to authenticated
  using ((select auth.uid()) = public.lit_console_operator())
  with check ((select auth.uid()) = public.lit_console_operator());

create policy lit_suppression_authenticated_all
  on public.lit_suppression
  for all
  to authenticated
  using ((select auth.uid()) = public.lit_console_operator())
  with check ((select auth.uid()) = public.lit_console_operator());

-- Belt and braces. Even with RLS on, the anon role should hold no grant.
revoke all on public.lit_targets     from anon;
revoke all on public.lit_tracker     from anon;
revoke all on public.lit_suppression from anon;

grant select, insert, update, delete on public.lit_targets     to authenticated;
grant select, insert, update, delete on public.lit_tracker     to authenticated;
grant select, insert, update, delete on public.lit_suppression to authenticated;
