-- Migration: Create team_members table for Meet the Team carousel

create table team_members (
  id             uuid        default gen_random_uuid() primary key,
  name           text        not null,
  title          text        not null,
  synopsis       text        not null default '',
  about          text        not null default '',
  image_data     text,
  display_order  integer     not null default 0,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table team_members enable row level security;

create policy "team_read"   on team_members for select using (true);
create policy "team_insert" on team_members for insert with check (true);
create policy "team_update" on team_members for update using (true);
create policy "team_delete" on team_members for delete using (true);

-- Seed: Samuel Barlow (references local image file)
insert into team_members (name, title, synopsis, about, image_data, display_order)
values (
  'Samuel Barlow',
  'Founder, Elama Consulting',
  'Technology-driven business strategist, growth consultant, and executive advisor',
  $$Samuel Barlow is a technology-driven business strategist, growth consultant, and executive advisor with a strong background in software, AI, and commercial operations. With expertise spanning business development, systems design, automation, and strategic scaling, Samuel helps founders and leadership teams break through growth ceilings, streamline operations, and build businesses that perform efficiently without constant owner involvement.

Combining technical insight with commercial execution, Samuel works with companies to modernise workflows, improve profitability, strengthen sales performance, and unlock new revenue opportunities. His approach blends practical business strategy with emerging technology, enabling organisations to scale smarter in an increasingly digital economy.

In addition to consulting, Samuel brings a unique advantage to U.S. businesses through access to the PCMP (Preventive Care Management Program), a federally funded wellness and benefits solution that can save employers $620+ per employee annually with zero reduction in employee take-home pay. This allows companies to improve workforce wellbeing while reducing operating costs.$$,
  'images/samuel.jpg',
  0
);
