-- Migration: create unsubscribes table for email campaign opt-outs
-- Run this in: Supabase Dashboard → SQL Editor

create table if not exists unsubscribes (
  id         uuid        default gen_random_uuid() primary key,
  email      text        not null unique,
  created_at timestamptz default now()
);

alter table unsubscribes enable row level security;

-- Anyone can insert (opt-out from email link)
create policy "public insert"
  on unsubscribes
  for insert
  with check (true);

-- Anon users cannot read the list (service role can)
-- The send.js script uses the service role key to fetch suppressions
