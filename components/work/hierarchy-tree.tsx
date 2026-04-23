"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { StatusBadge } from "./status-badge";
import { PriorityBadge } from "./priority-badge";
import { OwnerAvatar } from "./owner-avatar";
import { cn } from "@/lib/utils";
import type { Priority, WorkStatus } from "@prisma/client";

export type TreeNode = {
  id: string;
  name: string;
  href: string;
  status: WorkStatus;
  priority: Priority;
  owner?: { name?: string | null; image?: string | null } | null;
  kind: string;
  children?: TreeNode[];
};

export function HierarchyTree({ nodes }: { nodes: TreeNode[] }) {
  if (nodes.length === 0) {
    return (
      <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
        No children yet.
      </div>
    );
  }
  return (
    <div className="rounded-md border bg-card">
      {nodes.map((n, i) => (
        <TreeRow key={n.id} node={n} depth={0} last={i === nodes.length - 1} />
      ))}
    </div>
  );
}

function TreeRow({
  node,
  depth,
  last: _last,
}: {
  node: TreeNode;
  depth: number;
  last: boolean;
}) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = (node.children?.length ?? 0) > 0;
  return (
    <div>
      <div
        className={cn("flex items-center gap-2 border-b px-3 py-2 hover:bg-accent/30", depth > 0 && "bg-muted/20")}
        style={{ paddingLeft: 12 + depth * 16 }}
      >
        {hasChildren ? (
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex h-4 w-4 items-center justify-center rounded hover:bg-accent"
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="h-4 w-4" />
        )}
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {node.kind}
        </span>
        <Link href={node.href} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
          {node.name}
        </Link>
        <PriorityBadge priority={node.priority} />
        <StatusBadge status={node.status} />
        <OwnerAvatar name={node.owner?.name} image={node.owner?.image} />
      </div>
      {open &&
        node.children?.map((c, i) => (
          <TreeRow key={c.id} node={c} depth={depth + 1} last={i === node.children!.length - 1} />
        ))}
    </div>
  );
}
