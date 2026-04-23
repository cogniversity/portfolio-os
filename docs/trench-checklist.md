# Phase 1 Trench Checklist

## Trench 0 — Foundation
- [x] Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui
- [x] `docker-compose.yml` with Postgres 16 + Adminer
- [x] Prisma initialized, `.env` + `.env.example`, npm scripts (`dev`, `db:*`)
- [x] Base layout: sidebar nav, topbar with theme toggle
- [x] README

## Trench 1 — Auth, Profiles, Roles
- [x] Prisma models: `User`, `Account`, `Session`, `Profile`, `Team`, `UserRole`
- [x] Auth.js (v5) config with Credentials + Google, `@auth/prisma-adapter`
- [x] Pages: `/login`, `/signup`, `/profile`
- [x] Middleware redirect + role-aware sidebar (Settings hidden for non-PM)
- [x] `lib/rbac.ts` with `requireUser`, `requireRole`, `canWriteAssigned`

## Trench 2 — Work Hierarchy
- [x] Prisma models: `Portfolio`, `Product`, `Initiative`, `Epic`, `Story`, `Task`, `InitiativeProduct`
- [x] Server actions for create/update/delete with Zod + role checks + activity logging
- [x] List + detail pages at every level with breadcrumbs
- [x] Reusable `WorkItemRow`, `HierarchyTree`, `WorkItemForm`, `PageHeader`, `DeleteButton`

## Trench 3 — Initiative Types & Custom Fields
- [x] Models: `InitiativeType`, `CustomFieldDefinition`, `CustomFieldValue`
- [x] Seed 6 built-in types (Customization, Variant, Demo, Event, PoV, Other) with spec fields
- [x] `/settings/initiative-types` CRUD + field builder
- [x] Dynamic form renderer on initiative create/edit

## Trench 4 — Releases
- [x] `Release` model + status workflow (Planned | InDevelopment | Released | Deprecated)
- [x] `ReleaseEpic`, `ReleaseStory` cherry-pick joins with server actions
- [x] Release list + detail pages (scope, comments, activity)
- [x] Add-to-release picker on release detail

## Trench 5 — Roadmap + Timeline Shift
- [x] `/roadmap` swimlanes grouped by product, W/M/Q/Y toggle
- [x] Bars for initiatives/epics, release markers, type color coding
- [x] dnd-kit drag-to-reschedule with snap to granularity
- [x] `lib/timeline.ts` — `computeShiftImpact` + `applyShiftImpact` (pure async)
- [x] `TimelineShiftModal` preview with release-date breaks; writes `TIMELINE_SHIFT` activity
- [x] Sticky filter bar (product, type, owner, status)

## Trench 6 — Kanban + Calendar
- [x] `/kanban?scope=product|release&id=…&kind=story|epic|task` — drag between columns, status update + activity log
- [x] `/calendar` — month grid with releases, initiative starts/targets, and custom `DATE` fields (demo/event/PoV)

## Trench 7 — My Work + Leader Dashboard
- [x] `/my-work` — items where `ownerId = me` OR `assigneeId = me`, grouped by due bucket (Overdue / This week / Next week / Later / No date) and by status
- [x] `/dashboard` — KPI cards (released this Q, upcoming, on-track %, at-risk), initiatives-by-type breakdown, filterable "What's planned" timeline, upcoming releases, recent activity, at-risk list

## Trench 8 — Comments + Activity Log
- [x] `Comment` + `ActivityLog` models (polymorphic on `itemType` + `itemId`)
- [x] `logActivity()` helper called from every mutation
- [x] Detail tabs (Overview | Comments | Activity) on Portfolio/Product/Initiative/Epic/Story/Release pages
- [x] `@mention` autocomplete in comment form

## Trench 9 — Reports + CSV
- [x] `/reports` hub with four reports
  - [x] Release plan (per release: scope, status, owners, dates)
  - [x] Roadmap export (per product, per quarter)
  - [x] Workload (per person, with team filter)
  - [x] Initiative by type (with custom fields per type)
- [x] Filter bar + table on each report
- [x] "Export CSV" via `/api/reports/*` + "Print" via CSS print stylesheet

## Trench 10 — Polish, Seed, Docs
- [x] Dark mode via HSL CSS variables across all surfaces
- [x] Status/priority/type color tokens consistent across badges, roadmap, calendar, kanban
- [x] Avatar stacks (`OwnerAvatarStack`), sticky filter headers on Roadmap/Kanban/Calendar/Reports
- [x] `prisma/seed.ts` — 2 portfolios, 4 products, 12 initiatives across all types, epics/stories/tasks, 12 releases, 9 users (3 per role)
- [x] README + `docs/architecture.md` + this checklist

## Deferred to Phase 2

- Gantt with full dependency critical-path view
- Real-time notifications (in-app + email)
- File attachments on items
- SSO beyond Google
