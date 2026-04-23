import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatusBadge } from "./status-badge";
import { PriorityBadge } from "./priority-badge";
import { OwnerAvatar } from "./owner-avatar";
import { ProgressBar } from "./progress-bar";
import { formatDate } from "@/lib/utils";
import type { Priority, WorkStatus } from "@prisma/client";

export type WorkItemRowData = {
  id: string;
  name: string;
  href: string;
  status: WorkStatus;
  priority: Priority;
  targetDate?: Date | null;
  owner?: { name?: string | null; image?: string | null } | null;
  meta?: React.ReactNode;
  progress?: number;
};

export function WorkItemRow({ item }: { item: WorkItemRowData }) {
  return (
    <Link
      href={item.href}
      className="group flex items-center gap-3 border-b px-4 py-2.5 hover:bg-accent/40"
    >
      <PriorityBadge priority={item.priority} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{item.name}</div>
        {item.meta && (
          <div className="mt-0.5 text-xs text-muted-foreground">{item.meta}</div>
        )}
        {item.progress !== undefined && (
          <ProgressBar value={item.progress} className="mt-1.5 max-w-xs" />
        )}
      </div>
      <StatusBadge status={item.status} />
      <div className="hidden w-24 text-xs text-muted-foreground sm:block">
        {formatDate(item.targetDate)}
      </div>
      <OwnerAvatar name={item.owner?.name} image={item.owner?.image} />
      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

export function WorkItemRowList({ items }: { items: WorkItemRowData[] }) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        Nothing here yet.
      </div>
    );
  }
  return <div className="divide-y rounded-md border bg-card">{items.map((i) => <WorkItemRow key={i.id} item={i} />)}</div>;
}
