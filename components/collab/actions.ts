"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  itemType: z.enum([
    "PORTFOLIO",
    "PRODUCT",
    "INITIATIVE",
    "EPIC",
    "STORY",
    "TASK",
    "RELEASE",
  ]),
  itemId: z.string(),
  body: z.string().min(1).max(5000),
  mentions: z.array(z.string()).default([]),
});

export async function addCommentAction(input: z.input<typeof schema>) {
  const user = await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid comment" };
  const d = parsed.data;
  const c = await prisma.comment.create({
    data: {
      itemType: d.itemType,
      itemId: d.itemId,
      authorId: user.id,
      body: d.body,
      mentions: d.mentions,
    },
  });
  await logActivity({
    itemType: d.itemType,
    itemId: d.itemId,
    actorId: user.id,
    kind: "COMMENTED",
    summary: "commented",
    diff: { commentId: c.id, preview: d.body.slice(0, 80) },
  });
  revalidatePath(`/${d.itemType.toLowerCase()}s/${d.itemId}`);
  return { ok: true as const };
}
