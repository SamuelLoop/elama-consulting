-- Migration: create leads table
-- Run this in: Supabase Dashboard → SQL Editor

create table if not exists leads (
  id         uuid        default gen_random_uuid() primary key,
  name       text        not null,
  email      text        not null,
  company    text,
  interest   text,
  message    text,
  created_at timestamptz default now()
);

-- Row Level Security: allow anyone to INSERT (public form), nobody to SELECT
alter table leads enable row level security;

create policy "public insert only"
  on leads
  for insert
  with check (true);

-- Only the service role (your dashboard) can read leads
-- Anon/public users cannot read other people's submissions
