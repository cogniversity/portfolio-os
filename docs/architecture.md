# Architecture

## Overview

Portfolio OS is a single Next.js app with the App Router. All mutations go through Server Actions that enforce RBAC via `lib/rbac.ts` and emit activity log entries via `lib/activity.ts`. The UI is composed of Server Components (data fetching + first paint) plus thin Client Components for interactivity (drag/drop, filter state, forms).

```
Browser ─► Next.js (App Router)
            ├── Server Components   ── Prisma ──► Postgres
            ├── Server Actions      ── Zod ──► RBAC ──► Prisma + ActivityLog
            └── API Routes          (/api/auth, /api/reports/*.csv)
```

## Data model

See `prisma/schema.prisma`. Core entities:

- **Users/roles**: `User`, `Profile`, `Team`, `UserRole` (LEADER | PRODUCT_MANAGER | TEAM_MEMBER)
- **Work hierarchy**: `Portfolio` → `Product` ↔ `Initiative` (m2m via `InitiativeProduct`) → `Epic` → `Story` → `Task`
- **Types & custom fields**: `InitiativeType`, `CustomFieldDefinition`, `CustomFieldValue` (value stored as JSON)
- **Releases**: `Release` with `ReleaseEpic` / `ReleaseStory` cherry-pick joins
- **Collab**: `Comment` (polymorphic on `itemType` + `itemId`), `ActivityLog` (same polymorphism)

Every work item row carries: `name`, `description`, `ownerId`, `status`, `priority`, `startDate`, `targetDate`, `actualDate`, `orderIndex`, `createdAt`, `updatedAt`.

## RBAC

`lib/rbac.ts` exposes `requireUser`, `requireRole`, `canWrite`, `canWriteAssigned`. Every server action either:

1. calls `requireRole("PRODUCT_MANAGER")` for PM-only mutations (types, portfolios, products, initiatives, releases), or
2. calls `canWriteAssigned(user, ownerId, assigneeId)` for work items where team members may edit their own (stories, tasks, and kanban moves).

Middleware (`middleware.ts`) redirects unauthenticated users to `/login`.

## Timeline-shift engine

`lib/timeline.ts` isolates the cascading-date logic in pure async functions:

- `computeShiftImpact(target, newStart, newEnd)` — given an initiative/epic/story move, proportionally shifts children, bubbles the parent target up to `max(child.targetDate)`, and flags any release whose `plannedDate` is now earlier than its latest epic/story target.
- `applyShiftImpact(impact, { pushReleases })` — performs the writes atomically and records a `TIMELINE_SHIFT` activity.

The roadmap UI calls `previewShiftAction` on drag end, displays the impact in `TimelineShiftModal`, and only writes when the user confirms.

## UI patterns

- `PageHeader` — sticky top header with title/description/actions
- `WorkItemForm` — shared create/edit form; extended per entity with `extraFields` (e.g., initiative type selector, story assignee)
- `WorkItemRowList`, `HierarchyTree` — reusable list primitives
- `StatusBadge`, `PriorityBadge`, `OwnerAvatar` + `OwnerAvatarStack` — consistent visual tokens
- `ActivityFeed`, `Comments`, `CommentForm` — dropped into any detail page via `<Comments itemType="…" itemId={…} />`
- `ReportToolbar` — print + CSV export buttons for report pages
- `next-themes` — `ThemeProvider` + `ThemeToggle` in the topbar; all colors sourced from HSL CSS variables (`app/globals.css`) for seamless dark mode

## CSV + Print

- `lib/csv.ts` wraps `papaparse` with a minimal `toCSV` + `csvResponse` pair.
- API routes under `/api/reports/*` stream CSV with role check.
- Print styles in `app/globals.css` hide nav chrome and neutralize link colors (`.no-print`, `.print-container`).

## Seed

`prisma/seed.ts` creates 9 users (3 per role), 2 teams, 2 portfolios, 4 products, 12 initiatives spanning all 6 built-in types (Customization, Variant, Demo, Event, PoV, Other), with epics/stories/tasks and 12 releases (3 per product) — enough to exercise roadmap, kanban, calendar, dashboard, and every report.
