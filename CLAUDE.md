# Elama Consulting — Claude Context

> This file is read automatically by Claude Code at session start.

## Project

Elama Consulting — professional marketing website for executive coaching + PCMP health benefits consulting (USA clients). Static HTML5 + Bootstrap 5 site with CSS parallax scrolling. Supabase used for lead capture only.

## Continuity vault

`/Users/samuelbarlow/Documents/Coding Loop Enrolment/elama-consulting`

**Start every session by reading:**
1. `05_continuity/SOUL.md`
2. `05_continuity/NEXT.md`
3. `05_continuity/LESSONS.md`

**End every session by updating:**
1. `05_continuity/WORKLOG.md`
2. `05_continuity/NEXT.md`
3. Session starter (refresh for next session)
4. `05_continuity/LESSONS.md` (if new gotchas)
5. `05_continuity/HANDOFF.md`

## Session mode check (MANDATORY)

Run `uname -a` at session start:
- **Darwin** → Local (Mac). Full access to vault.
- **Linux** → Cloud (sandbox). Cannot reach local files. Stop and tell the user.

## Stack

- **Structure:** HTML5 (single-page, multi-section)
- **Styling:** Bootstrap 5.3 (CDN) + custom css/styles.css
- **Effects:** CSS parallax, AOS scroll animations
- **Language:** Vanilla JavaScript (ES6+)
- **Backend:** Supabase JS (CDN) — contact form lead capture only
- **Package manager:** none (CDN-based)
- **Hosting:** Vercel (static)
- **Dev:** Open index.html in browser or `npx serve .`

## Site sections

1. **Hero** — parallax background, headline, CTA to book a call
2. **About** — Samuel's story and credentials
3. **Executive Coaching** — The Profit System (5 Levels, 3 Pillars, 9 Step Roadmap)
4. **Health Benefits** — PCMP / Ignite Health explainer
5. **Contact** — Lead capture form (saves to Supabase `leads` table)

## Branch strategy

- `main` → production (Vercel prod — TBD)
- `dev` → preview (Vercel preview — TBD)
- Feature branches off `dev`

## Smoke test

Open `index.html` in Chrome — all sections visible, nav scrolls correctly, contact form visible.

```bash
# Or serve locally:
npx serve .
```

## Supabase setup (when ready)

1. Create project at supabase.com
2. Run this SQL to create the leads table:
```sql
create table leads (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text not null,
  company text,
  message text,
  created_at timestamptz default now()
);
alter table leads enable row level security;
create policy "insert only" on leads for insert with check (true);
```
3. Drop anon key + URL into js/main.js where marked with TODO

## Hard rules

- Never present unvalidated assumptions as truth.
- Read the code before describing what it does.
- No inline styles — all custom styling goes in css/styles.css.
- No jQuery — vanilla JS only.
- Keep Bootstrap classes in HTML; custom overrides in styles.css.

## References

- **Global workstyle:** `../../../project-scaffolding/team/WORKSTYLE.md`
- **Project lessons:** `../../../05_continuity/LESSONS.md`
- **Booking link:** https://elamamarketing.com/schedule-a-meeting/
