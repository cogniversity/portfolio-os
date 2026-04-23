"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { canWriteAssigned, requireUser } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { baseItemSchema } from "@/lib/zod-schemas";

const taskSchema = baseItemSchema.extend({
  storyId: z.string(),
  assigneeId: z.string().nullable().optional(),
});

export async function createTask(input: z.input<typeof taskSchema>) {
  const user = await requireUser();
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const d = parsed.data;
  const count = await prisma.task.count({ where: { storyId: d.storyId } });
  const t = await prisma.task.create({
    data: {
      storyId: d.storyId,
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
    itemType: "TASK",
    itemId: t.id,
    actorId: user.id,
    kind: "CREATED",
    summary: `Created task "${t.name}"`,
  });
  revalidatePath(`/stories/${d.storyId}`);
  return { ok: true as const, id: t.id };
}

export async function updateTask(id: string, input: z.input<typeof taskSchema>) {
  const user = await requireUser();
  const prev = await prisma.task.findUniqueOrThrow({ where: { id } });
  if (!canWriteAssigned(user, prev.ownerId, prev.assigneeId)) {
    return { ok: false as const, error: "Permission denied" };
  }
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const d = parsed.data;
  const next = await prisma.task.update({
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
    itemType: "TASK",
    itemId: id,
    actorId: user.id,
    kind: prev.status !== next.status ? "STATUS_CHANGED" : "UPDATED",
    summary: `Updated task "${next.name}"`,
    diff: { prev, next },
  });
  revalidatePath(`/stories/${prev.storyId}`);
  return { ok: true as const, id };
}

export async function deleteTask(id: string) {
  const user = await requireUser();
  const t = await prisma.task.findUniqueOrThrow({ where: { id } });
  if (!canWriteAssigned(user, t.ownerId, t.assigneeId)) {
    return { ok: false as const, error: "Permission denied" };
  }
  await prisma.task.delete({ where: { id } });
  await logActivity({
    itemType: "TASK",
    itemId: id,
    actorId: user.id,
    kind: "DELETED",
    summary: `Deleted task "${t.name}"`,
  });
  revalidatePath(`/stories/${t.storyId}`);
  return { ok: true as const };
}
