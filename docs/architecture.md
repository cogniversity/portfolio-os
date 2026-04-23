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
- **Work hierarchy**: `Portfolio` → `Product` ↔ `Initiative` (m2m via `InitiativeProduct`) → `Epic` → `Story` → `Task`. An `Epic` may attach to an `Initiative`, a `Product` directly, or both — at least one parent is required (enforced in the Zod schema of `app/(app)/epics/actions.ts`).
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

`prisma/seed.ts` creates 9 users (3 per role), 2 teams, 2 portfolios, 4 products, 12 initiatives spanning all 6 built-in types (Customization, Variant, Demo, Event, PoV, Other), with epics/stories/tasks and 12 releases (3 per product) — enough to exercise roadmap, kanban, calendar, dashboard, and every report. One product-direct epic is also created (no initiative parent) to exercise the alternate parenting path.

## Flexible Epic parenting

An `Epic` has two nullable parents — `initiativeId` and `productId` — with at-least-one-present enforced at the application layer rather than via a DB CHECK constraint, keeping the migration trivial. This lets teams model work that belongs to a product but isn't part of any strategic initiative (platform hardening, tech debt, operational hygiene) while cross-product initiatives remain fully supported via the existing `InitiativeProduct` m2m.

Downstream views fan out additively:

- **Roadmap** renders product-direct epics as top-level bars in the product's swimlane alongside initiatives (synthetic `InitiativeRow` with empty `epics`).
- **Kanban** product-scope queries `OR` on `initiative.products.some` and direct `productId` for epics / stories / tasks.
- **Calendar** emits start/target events for product-direct epics mirroring the initiative block.
- **Product detail** has an "Epics (direct)" tab and an "Add epic" shortcut that pre-fills `?productId=`.
- **Initiatives tab** on product detail shows a `Shared N products` badge for cross-product initiatives.

## AI assist layer

`lib/ai/*` adds three optional OpenAI-backed capabilities; none are reachable unless `OPENAI_API_KEY` is set (`isAIConfigured()` gates both UI visibility and server-side calls).

```
UI (client)
  ├── /ai/plan             → draftHierarchyFromText → preview tree → applyHierarchyDraft
  ├── SuggestChildrenButton → suggestChildren      → preview list → applyChildrenDraft
  └── DescribeAssistant    → improveDescription    → Accept replaces textarea state
                                   ▲
                                   │ server actions (lib/ai/actions.ts)
                                   │   assertCanWrite → rate-limit → OpenAI (JSON mode) → Zod validate
                                   ▼
                                OpenAI / Azure
```

Contract: **AI proposes, the user disposes.** No action ever writes to the database on the first hop. Draft actions (`draftHierarchyFromText`, `suggestChildren`, `improveDescription`) return a validated JSON draft. A separate apply action (`applyHierarchyDraft`, `applyChildrenDraft`) runs inside `prisma.$transaction`, creates rows, and records one `logActivity` entry per created item with `diff: { source: "ai" }`.

Key files:

- `lib/ai/client.ts` — lazy OpenAI client, typed `AIConfigError` / `AIRuntimeError`, 8 KB prose trimmer.
- `lib/ai/schemas.ts` — Zod schemas for every response shape. Drafts carry temp `ref` strings so children can reference proposed parents without inventing cuids; apply schemas accept both `ref` (new) and `existingId` (existing entity) for cross-referencing.
- `lib/ai/prompts.ts` — pure builder functions. System prompt encodes the glossary (hierarchy, enums, initiative types) and forbids DB ids. Each builder returns `{ system, user }`.
- `lib/ai/actions.ts` — `"use server"` entry points. All draft/apply actions call `assertCanWrite()` first; OpenAI calls run with `response_format: { type: "json_object" }` and are validated with Zod before being returned or persisted.
- `lib/ai/rate-limit.ts` — in-memory token bucket per `(userId, capability)`; best-effort in single-instance dev.

UI primitives in `components/ai/`:

- `AiButton` — branded button with spinner and Sparkles icon.
- `SuggestionsDialog` — reusable preview list; each row has editable name/description/status/priority plus keep-toggle; footer apply disabled until at least one row is kept.
- `DescribeAssistant` — popover rendered next to every Description label (driven by optional `aiContext` prop on `WorkItemForm` and directly in `ReleaseForm`); Accept replaces the textarea state, Regenerate re-calls, Cancel dismisses.
- `SuggestChildrenButton` — drops into PageHeader action slots on Product / Initiative / Epic / Story detail pages; for Product, lets the PM switch between Initiative and direct-Epic children inside the dialog.

Audit: no schema migration. Each `ActivityLog` row written during apply carries `diff.source = "ai"`; the existing feed renders it today as a normal CREATED row and a future UI tweak can surface an "AI-assisted" badge by reading that field.

Risks mitigated:

- **Hallucinated parents** — LLM never receives or emits DB ids; the preview panel resolves temp `ref` strings via dropdowns backed by real entities.
- **Runaway token cost** — pasted prose trimmed to 8 KB in `lib/ai/client.ts` and per-user rate limits in `lib/ai/rate-limit.ts`.
- **Missing API key in prod** — `lib/ai/client.ts` throws a typed `AIConfigError`; UI shows an explicit "AI is not configured" empty state instead of crashing.
- **Schema drift** — Zod validates every response; malformed output surfaces as "AI returned invalid data, try again" rather than being written to DB.
