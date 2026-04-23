import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { OwnerAvatar } from "@/components/work/owner-avatar";
import { CommentForm } from "./comment-form";
import type { WorkItemType } from "@prisma/client";

export async function Comments({
  itemType,
  itemId,
}: {
  itemType: WorkItemType;
  itemId: string;
}) {
  const session = await auth();
  const [comments, users] = await Promise.all([
    prisma.comment.findMany({
      where: { itemType, itemId },
      include: { author: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="divide-y rounded-md border bg-card">
        {comments.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">No comments yet.</div>
        )}
        {comments.map((c) => (
          <div key={c.id} className="flex items-start gap-3 p-3">
            <OwnerAvatar name={c.author.name} image={c.author.image} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{c.author.name ?? c.author.email}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(c.createdAt)}
                </span>
              </div>
              <div className="mt-1 whitespace-pre-wrap text-sm">
                {renderBodyWithMentions(c.body)}
              </div>
            </div>
          </div>
        ))}
      </div>
      {session?.user && (
        <CommentForm itemType={itemType} itemId={itemId} users={users} />
      )}
    </div>
  );
}

function renderBodyWithMentions(body: string) {
  const parts = body.split(/(@[\w.-]+)/g);
  return parts.map((p, i) =>
    p.startsWith("@") ? (
      <span
        key={i}
        className="rounded bg-primary/15 px-1 font-medium text-primary"
      >
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}
