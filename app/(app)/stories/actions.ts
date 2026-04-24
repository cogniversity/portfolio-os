"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { canWriteAssigned, requireUser } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { baseItemSchema, priorityEnum, workStatusEnum } from "@/lib/zod-schemas";

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

const clearableDate = z
  .union([z.null(), z.string(), z.date()])
  .transform((v) => {
    if (v === null || v === "") return null;
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? null : d;
  });

const storyBulkPatchSchema = z
  .object({
    ownerId: z.string().nullable().optional(),
    assigneeId: z.string().nullable().optional(),
    startDate: clearableDate.optional(),
    targetDate: clearableDate.optional(),
    status: workStatusEnum.optional(),
    priority: priorityEnum.optional(),
  })
  .refine(
    (p) =>
      p.ownerId !== undefined ||
      p.assigneeId !== undefined ||
      p.startDate !== undefined ||
      p.targetDate !== undefined ||
      p.status !== undefined ||
      p.priority !== undefined,
    { message: "At least one field is required" },
  );

export async function bulkUpdateStories(
  input: z.input<typeof storyBulkPatchSchema> &
    { storyIds: string[] } & (
      | { epicId: string; initiativeId?: undefined }
      | { initiativeId: string; epicId?: undefined }
    ),
) {
  const user = await requireUser();
  const { storyIds, epicId, initiativeId, ...rawPatch } = input as {
    storyIds: string[];
    epicId?: string;
    initiativeId?: string;
  } & z.input<typeof storyBulkPatchSchema>;

  if ((epicId && initiativeId) || (!epicId && !initiativeId)) {
    return { ok: false as const, error: "Specify either epic or initiative scope" };
  }

  const parsed = storyBulkPatchSchema.safeParse(rawPatch);
  if (!parsed.success) return { ok: false as const, error: "Nothing to update" };
  const patch = parsed.data;
  if (storyIds.length === 0) return { ok: false as const, error: "No stories selected" };

  const stories = await prisma.story.findMany({
    where: {
      id: { in: storyIds },
      ...(epicId
        ? { epicId }
        : { epic: { initiativeId: initiativeId! } }),
    },
    select: { id: true, ownerId: true, assigneeId: true, name: true, epicId: true },
  });
  if (stories.length !== storyIds.length) {
    return {
      ok: false as const,
      error: epicId
        ? "Some stories are missing or not in this epic"
        : "Some stories are missing or not under this initiative",
    };
  }
  for (const s of stories) {
    if (!canWriteAssigned(user, s.ownerId, s.assigneeId)) {
      return { ok: false as const, error: "Permission denied for one or more selected stories" };
    }
  }

  const data: Record<string, unknown> = {};
  if (patch.ownerId !== undefined) data.ownerId = patch.ownerId;
  if (patch.assigneeId !== undefined) data.assigneeId = patch.assigneeId;
  if (patch.startDate !== undefined) data.startDate = patch.startDate;
  if (patch.targetDate !== undefined) data.targetDate = patch.targetDate;
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.priority !== undefined) data.priority = patch.priority;

  await prisma.$transaction(
    storyIds.map((id) =>
      prisma.story.update({
        where: { id },
        data,
      }),
    ),
  );

  const keys = Object.keys(data);
  if (epicId) {
    await logActivity({
      itemType: "EPIC",
      itemId: epicId,
      actorId: user.id,
      kind: "UPDATED",
      summary: `Bulk-updated ${storyIds.length} stor${storyIds.length === 1 ? "y" : "ies"} (${keys.join(", ")})`,
      diff: { storyIds, fields: data },
    });
    revalidatePath(`/epics/${epicId}`);
  } else {
    await logActivity({
      itemType: "INITIATIVE",
      itemId: initiativeId!,
      actorId: user.id,
      kind: "UPDATED",
      summary: `Bulk-updated ${storyIds.length} stor${storyIds.length === 1 ? "y" : "ies"} (${keys.join(", ")})`,
      diff: { storyIds, fields: data },
    });
    revalidatePath(`/initiatives/${initiativeId}`);
  }

  const epicIds = new Set(stories.map((s) => s.epicId));
  for (const eid of epicIds) revalidatePath(`/epics/${eid}`);
  for (const id of storyIds) revalidatePath(`/stories/${id}`);
  return { ok: true as const, count: storyIds.length };
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
