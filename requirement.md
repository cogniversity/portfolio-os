
# Product Management & Roadmap Platform

A multi-persona product management app for managing portfolios, products, initiatives, and execution — with roadmap timelines, release planning, and timeline-shift detection.

## Personas & Auth
- **Auth**: Email/password + Google sign-in (Lovable Cloud).
- **Roles** (stored in `user_roles` table, RLS-enforced):
  - **Leader** — read-only across everything; dashboards, reports, roadmap views.
  - **Product Manager** — full CRUD on products, initiatives, releases, epics; assigns work; reprioritizes.
  - **Team Member** — sees assigned epics/stories/tasks; updates status, comments, logs progress.
- Profile: name, avatar, role, team.

## Work Hierarchy
```
Portfolio
  ├── Product ──┐
  └── Initiative┴── Epic ── Story ── Task
                      │
                      └── (cross-product: many-to-many to Products)

Releases / Milestones (parallel grouping)
  └── span Epics; Stories can be cherry-picked into specific releases
```
- Every level has: title, description, owner, status, priority, target dates, custom fields.
- Initiatives can link to **one or many Products** (cross-product support).

## Initiative Types (admin-configurable)
Built-in: **Customization, Variant, Demo, Event, PoV, Other** — each with type-specific fields:
- *Customization / Variant* → customer, base product, variant spec
- *Demo* → customer/domain, demo date, audience
- *Event* → event name, date, location, booth/session
- *PoV* → customer, success criteria, start/end
- *Other* → free-form
- **Settings → Initiative Types**: Admin/PM creates new types and defines custom fields (text, number, date, select, customer-link).

## Key Views

**1. Roadmap (primary)**
- Swimlanes grouped by Product (or Portfolio).
- Toggle granularity: **Week / Month / Quarter / Year**.
- Releases shown as vertical milestone markers; initiatives/epics as bars.
- Drag to reschedule or reprioritize → system **detects timeline shifts** on dependent items and shows a "Timeline Impact" panel (which items moved, by how much, conflicts).
- Filter by product, initiative type, owner, release, status.

**2. Gantt (dependencies)**
- Cross-hierarchy dependency lines.
- Critical-path highlighting; flagged when a shift breaks a release date.

**3. Kanban**
- Per product or per release; columns = status (Backlog → In Progress → In Review → Done → Released).
- Drag cards to update status.

**4. Calendar**
- Monthly view of releases, demos, events, PoV milestones.

**5. Portfolio / Product / Initiative detail pages**
- Tree of children with inline status, assignee avatars, progress bars.
- Description, custom fields, attachments, comments, activity log.

**6. My Work** (Team Member home)
- Everything assigned to me across products, grouped by due date and status.

**7. Leader Dashboard**
- KPIs: releases published this Q, upcoming releases, % on-track, at-risk initiatives, initiatives by type.
- "What's planned this week / month / quarter / year" — filterable timeline summary.
- Released vs Upcoming vs Planned breakdown.

**8. Reports & Plans**
- Release plan (per release: scope, status, owners, dates).
- Roadmap export (per product, per quarter).
- Workload report (assignments per person/team).
- Initiative report by type (e.g., all customer customizations).
- Export as CSV / printable view.

## Statuses & Workflow
- Items: `Draft → Planned → In Progress → In Review → Done → Released → Cancelled`.
- Releases: `Planned → In Development → Released → Deprecated`.
- Priority: `P0 / P1 / P2 / P3` with drag-to-reorder within a list.

## Timeline-Shift Detection
When a PM reprioritizes or moves an item:
- System recalculates affected children, dependent items, and parent roll-up dates.
- Surfaces a confirmation modal: "This change moves 4 stories and pushes Release 2.3 by 2 weeks. Continue?"
- Logs the shift in activity history for leader visibility.

## Collaboration
- Comments with @mentions on every item.
- Activity log per item (status changes, reassignments, date moves).
- Notifications panel (in-app) for assignments, mentions, status changes on watched items.

## Navigation
Sidebar: Dashboard · My Work · Roadmap · Portfolios · Products · Initiatives · Releases · Reports · Settings (Admin/PM only: users, roles, initiative types, custom fields).

## Design
Clean, dense, data-first UI (Linear/Aha-inspired). Light + dark mode. Color-coded by initiative type and status. Avatar stacks for assignees. Sticky filters on roadmap.

## Phase 1 Scope (initial build)
1. Auth + roles + personas
2. Portfolios → Products → Initiatives → Epics → Stories → Tasks (CRUD, hierarchy)
3. Releases (with epic/story association)
4. Initiative types with custom fields (built-in 6 + admin-configurable)
5. Roadmap swimlane view (Week/Month/Quarter/Year) with drag-to-reschedule + timeline-shift detection
6. Kanban + Calendar views
7. My Work + Leader Dashboard
8. Comments + activity log
9. Reports (release plan, roadmap, workload, initiative-by-type) with CSV export

Gantt with full dependency graph and notifications can be added in a follow-up phase to keep the first build focused and shippable.
