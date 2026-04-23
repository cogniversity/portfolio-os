import type { Priority, WorkStatus, ReleaseStatus } from "@prisma/client";

export const STATUS_LABELS: Record<WorkStatus, string> = {
  DRAFT: "Draft",
  PLANNED: "Planned",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
  RELEASED: "Released",
  CANCELLED: "Cancelled",
};

export const STATUS_ORDER: WorkStatus[] = [
  "DRAFT",
  "PLANNED",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
  "RELEASED",
  "CANCELLED",
];

export const KANBAN_COLUMNS: WorkStatus[] = [
  "PLANNED",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
  "RELEASED",
];

export const STATUS_COLORS: Record<WorkStatus, string> = {
  DRAFT: "bg-status-draft/15 text-status-draft border-status-draft/30",
  PLANNED: "bg-status-planned/15 text-status-planned border-status-planned/30",
  IN_PROGRESS: "bg-status-progress/15 text-status-progress border-status-progress/30",
  IN_REVIEW: "bg-status-review/15 text-status-review border-status-review/30",
  DONE: "bg-status-done/15 text-status-done border-status-done/30",
  RELEASED: "bg-status-released/15 text-status-released border-status-released/30",
  CANCELLED: "bg-status-cancelled/15 text-status-cancelled border-status-cancelled/30",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  P0: "P0 — Critical",
  P1: "P1 — High",
  P2: "P2 — Medium",
  P3: "P3 — Low",
};

export const PRIORITY_ORDER: Priority[] = ["P0", "P1", "P2", "P3"];

export const PRIORITY_COLORS: Record<Priority, string> = {
  P0: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  P1: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
  P2: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  P3: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30",
};

export const RELEASE_STATUS_LABELS: Record<ReleaseStatus, string> = {
  PLANNED: "Planned",
  IN_DEVELOPMENT: "In Development",
  RELEASED: "Released",
  DEPRECATED: "Deprecated",
};

export const INITIATIVE_TYPE_COLORS = [
  "#6366f1",
  "#ec4899",
  "#f97316",
  "#10b981",
  "#eab308",
  "#06b6d4",
  "#8b5cf6",
  "#ef4444",
];
