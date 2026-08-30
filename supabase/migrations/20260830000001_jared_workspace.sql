-- Jared Partnership workspace: a single-row JSONB store, gated by an access
-- code that is checked server-side. The table has RLS with no anon policies,
-- so the anon key alone can read nothing; access is only through the two
-- SECURITY DEFINER functions below, both of which require the code.

create table if not exists public.jared_workspace (
  id         text primary key default 'main',
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.jared_workspace enable row level security;
-- deliberately no policies: direct table access is denied to anon/authenticated.

create table if not exists public.jared_config (
  key   text primary key,
  value text not null
);
alter table public.jared_config enable row level security;
-- deliberately no policies: only the SECURITY DEFINER functions read this.

-- Placeholder code. DO NOT rely on this. After applying, set the real one:
--   update public.jared_config set value = '<your access code>' where key = 'pin';
insert into public.jared_config(key, value)
  values ('pin', 'change-me')
  on conflict (key) do nothing;

create or replace function public.jared_ws_get(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pin  text;
  v_data jsonb;
begin
  select value into v_pin from public.jared_config where key = 'pin';
  if v_pin is null or p_pin is distinct from v_pin then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  select data into v_data from public.jared_workspace where id = 'main';
  return v_data; -- null until first seeded by the page
end;
$$;

create or replace function public.jared_ws_set(p_pin text, p_data jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pin text;
  v_ts  timestamptz;
begin
  select value into v_pin from public.jared_config where key = 'pin';
  if v_pin is null or p_pin is distinct from v_pin then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  insert into public.jared_workspace(id, data, updated_at)
    values ('main', p_data, now())
    on conflict (id) do update set data = excluded.data, updated_at = now()
  returning updated_at into v_ts;
  return v_ts;
end;
$$;

revoke all on function public.jared_ws_get(text)         from public;
revoke all on function public.jared_ws_set(text, jsonb)  from public;
grant execute on function public.jared_ws_get(text)        to anon, authenticated;
grant execute on function public.jared_ws_set(text, jsonb) to anon, authenticated;
