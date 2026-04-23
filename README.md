# Portfolio OS

A multi-persona product management and roadmap platform. Phase 1 covers the full work hierarchy (Portfolio → Product → Initiative → Epic → Story → Task), releases, interactive roadmap with timeline-shift detection, kanban, calendar, dashboards, comments, activity log, and reports.

## Stack

- Next.js 15 (App Router) + TypeScript + React Server Components
- Tailwind CSS + shadcn/ui + `next-themes` (light/dark)
- Postgres 16 (Docker) + Prisma ORM
- Auth.js (NextAuth v5) with Credentials + Google
- `@dnd-kit` for roadmap/kanban drag, `date-fns` for dates, `papaparse` for CSV
- Zod-validated Server Actions; role guards in `lib/rbac.ts`
- Optional OpenAI-powered AI assist (plan-with-text, Suggest children, Improve description) via `lib/ai/*`

## Quickstart

Requirements: Node 20+, Docker Desktop.

```bash
npm install
npm run db:up            # start Postgres on localhost:5432
cp .env.example .env     # generate AUTH_SECRET and set DATABASE_URL if needed
npm run db:migrate       # apply Prisma migrations (creates schema)
npm run db:seed          # seed demo data (9 users, 2 portfolios, 4 products, ~12 initiatives)
npm run dev              # http://localhost:3000
```

Sign in with any of the seeded accounts (password `password123`):

| Role            | Email                 |
| --------------- | --------------------- |
| Leader          | `leader@example.com`  |
| Product Manager | `pm@example.com`      |
| Team Member     | `team@example.com`    |

## Scripts

- `npm run dev` — Next.js dev server
- `npm run build` — production build (runs `prisma generate` first)
- `npm run db:up` / `db:down` — start/stop Docker Postgres + Adminer
- `npm run db:migrate` / `db:deploy` — migrations (dev / prod)
- `npm run db:seed` — seed demo data
- `npm run db:reset` — reset DB and reseed
- `npm run db:studio` — Prisma Studio

## Project layout

- `app/(app)/…` — authenticated app routes (dashboard, my-work, roadmap, kanban, calendar, portfolios, products, initiatives, releases, reports, settings)
- `app/api/…` — API handlers including `/api/reports/*` CSV endpoints and `/api/auth/[...nextauth]`
- `components/` — shadcn/ui primitives under `ui/`, feature components under `work/`, `collab/`, `layout/`, `reports/`
- `lib/` — `db.ts` (Prisma), `auth.ts` (NextAuth), `rbac.ts` (role guards), `timeline.ts` (shift engine), `csv.ts`, `activity.ts`
- `prisma/` — `schema.prisma`, migrations, `seed.ts`
- `docs/` — architecture notes and per-trench checklist

See [`docs/architecture.md`](docs/architecture.md) for a deeper tour and [`docs/trench-checklist.md`](docs/trench-checklist.md) for the Phase 1 delivery log.

## Roles (enforced via `lib/rbac.ts` in every server action)

- **Leader** — read-only everywhere, default landing on `/dashboard`
- **Product Manager** — full CRUD on portfolios, products, initiatives, releases, epics, types
- **Team Member** — read all; write only to items where `ownerId` or `assigneeId` matches self

## Notable surfaces

- `/roadmap` — swimlanes per product with W/M/Q/Y toggle; drag bars to reschedule; `TimelineShiftModal` previews cascading impacts (moved stories, pushed releases) before apply
- `/kanban` — per-product or per-release kanban for stories, epics, or tasks; drag between status columns
- `/calendar` — month grid rendering releases, initiative starts/targets, and custom `DATE` fields (demo date, event dates, PoV windows)
- `/my-work` — owner + assignee items grouped by due-date bucket or status
- `/dashboard` — KPI cards, planned-work timeline, initiatives-by-type breakdown, upcoming releases, recent activity, at-risk initiatives
- `/reports` — release plan, roadmap, workload, initiative-by-type; each with filters, CSV export, and a print-friendly stylesheet
- `/settings/initiative-types` — CRUD for types plus a field builder for custom fields (text/number/date/select/textarea/customer-link)
- `/ai/plan` (PM-only) — paste prose (PRD, notes, transcript) and preview an editable tree of suggested initiatives/epics/stories before committing in one transaction

## Optional: enable AI assist

Set these in `.env` (or your deploy secrets) to unlock the `/ai/plan` page, the "Suggest children" action on every hierarchy detail page, and the "Improve with AI" popover on every description field:

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini    # optional; defaults to gpt-4o-mini
OPENAI_BASE_URL=            # optional; set for Azure / OpenAI-compatible endpoints
```

All AI writes are gated by the PM role and flow through a preview panel — the user reviews, edits, toggles, and confirms before anything touches the database. Applied items are logged with `diff.source = "ai"` in the activity feed.

## What's deferred to Phase 2

- Gantt with full dependency critical-path view
- Real-time notifications (in-app + email)
- File attachments on items
- SSO beyond Google
