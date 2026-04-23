"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { canWriteAssigned, requireUser } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { baseItemSchema } from "@/lib/zod-schemas";

const storySchema = baseItemSchema.extend({
  epicId: z.string(),
  assigneeId: z.string().nullable().optional(),
});

export async function createStory(input: z.input<typeof storySchema>) {
  const user = await requireUser();
  if (!canWriteAssigned(user, user.id, user.id) && user.roles?.includes("LEADER")) {
    return { ok: false as const, error: "Read-only" };
  }
  // PMs can always create; team members can create if epic assignee
  const parsed = storySchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const d = parsed.data;
  const count = await prisma.story.count({ where: { epicId: d.epicId } });
  const s = await prisma.story.create({
    data: {
      epicId: d.epicId,
      name: d.name,
      description: d.description ?? null,
      ownerId: d.ownerId ?? null,
      assigneeId: d.assigneeId ?? null,
      status: d.status,
      priority: d.priority,
      startDate: d.startDate ?? null,
      targetDate: d.targetDate ?? null,
      orderIndex: count,
    },
  });
  await logActivity({
    itemType: "STORY",
    itemId: s.id,
    actorId: user.id,
    kind: "CREATED",
    summary: `Created story "${s.name}"`,
  });
  revalidatePath(`/epics/${d.epicId}`);
  revalidatePath(`/stories/${s.id}`);
  return { ok: true as const, id: s.id };
}

export async function updateStory(id: string, input: z.input<typeof storySchema>) {
  const user = await requireUser();
  const prev = await prisma.story.findUniqueOrThrow({ where: { id } });
  if (!canWriteAssigned(user, prev.ownerId, prev.assigneeId)) {
    return { ok: false as const, error: "Permission denied" };
  }
  const parsed = storySchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const d = parsed.data;
  const next = await prisma.story.update({
    where: { id },
    data: {
      name: d.name,
      description: d.description ?? null,
      ownerId: d.ownerId ?? null,
      assigneeId: d.assigneeId ?? null,
      status: d.status,
      priority: d.priority,
      startDate: d.startDate ?? null,
      targetDate: d.targetDate ?? null,
    },
  });
  await logActivity({
    itemType: "STORY",
    itemId: id,
    actorId: user.id,
    kind: prev.status !== next.status ? "STATUS_CHANGED" : "UPDATED",
    summary: `Updated story "${next.name}"`,
    diff: { prev, next },
  });
  revalidatePath(`/epics/${prev.epicId}`);
  revalidatePath(`/stories/${id}`);
  return { ok: true as const, id };
}

export async function deleteStory(id: string) {
  const user = await requireUser();
  const s = await prisma.story.findUniqueOrThrow({ where: { id } });
  if (!canWriteAssigned(user, s.ownerId, s.assigneeId)) {
    return { ok: false as const, error: "Permission denied" };
  }
  await prisma.story.delete({ where: { id } });
  await logActivity({
    itemType: "STORY",
    itemId: id,
    actorId: user.id,
    kind: "DELETED",
    summary: `Deleted story "${s.name}"`,
  });
  revalidatePath(`/epics/${s.epicId}`);
  return { ok: true as const };
}

export async function updateStoryStatus(id: string, status: string) {
  const user = await requireUser();
  const s = await prisma.story.findUniqueOrThrow({ where: { id } });
  if (!canWriteAssigned(user, s.ownerId, s.assigneeId)) {
    return { ok: false as const, error: "Permission denied" };
  }
  await prisma.story.update({
    where: { id },
    data: { status: status as any },
  });
  await logActivity({
    itemType: "STORY",
    itemId: id,
    actorId: user.id,
    kind: "STATUS_CHANGED",
    summary: `Status: ${s.status} → ${status}`,
    diff: { from: s.status, to: status },
  });
  revalidatePath(`/kanban`);
  revalidatePath(`/stories/${id}`);
  return { ok: true as const };
}
