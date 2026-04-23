import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { OwnerAvatar } from "@/components/work/owner-avatar";
import type { WorkItemType } from "@prisma/client";

export async function ActivityFeed({
  itemType,
  itemId,
}: {
  itemType: WorkItemType;
  itemId: string;
}) {
  const activities = await prisma.activityLog.findMany({
    where: { itemType, itemId },
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  if (activities.length === 0) {
    return (
      <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
        No activity yet.
      </div>
    );
  }

  return (
    <div className="divide-y rounded-md border bg-card">
      {activities.map((a) => (
        <div key={a.id} className="flex items-start gap-3 p-3">
          <OwnerAvatar name={a.actor?.name} image={a.actor?.image} size="md" />
          <div className="min-w-0 flex-1">
            <div className="text-sm">
              <span className="font-medium">{a.actor?.name ?? "System"}</span>{" "}
              <span className="text-muted-foreground">{a.summary}</span>
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {formatDate(a.createdAt)} ·{" "}
              {new Date(a.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
