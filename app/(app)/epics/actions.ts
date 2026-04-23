"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCanWrite } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { baseItemSchema } from "@/lib/zod-schemas";

const epicSchema = baseItemSchema.extend({ initiativeId: z.string() });

export async function createEpic(input: z.input<typeof epicSchema>) {
  const user = await assertCanWrite();
  const parsed = epicSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const d = parsed.data;
  const count = await prisma.epic.count({ where: { initiativeId: d.initiativeId } });
  const e = await prisma.epic.create({
    data: {
      initiativeId: d.initiativeId,
      name: d.name,
      description: d.description ?? null,
      ownerId: d.ownerId ?? null,
      status: d.status,
      priority: d.priority,
      startDate: d.startDate ?? null,
      targetDate: d.targetDate ?? null,
      orderIndex: count,
    },
  });
  await logActivity({
    itemType: "EPIC",
    itemId: e.id,
    actorId: user.id,
    kind: "CREATED",
    summary: `Created epic "${e.name}"`,
  });
  revalidatePath(`/initiatives/${d.initiativeId}`);
  revalidatePath(`/epics/${e.id}`);
  return { ok: true as const, id: e.id };
}

export async function updateEpic(id: string, input: z.input<typeof epicSchema>) {
  const user = await assertCanWrite();
  const parsed = epicSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const d = parsed.data;
  const prev = await prisma.epic.findUniqueOrThrow({ where: { id } });
  const next = await prisma.epic.update({
    where: { id },
    data: {
      name: d.name,
      description: d.description ?? null,
      ownerId: d.ownerId ?? null,
      status: d.status,
      priority: d.priority,
      startDate: d.startDate ?? null,
      targetDate: d.targetDate ?? null,
    },
  });
  await logActivity({
    itemType: "EPIC",
    itemId: id,
    actorId: user.id,
    kind: "UPDATED",
    summary: `Updated epic "${next.name}"`,
    diff: { prev, next },
  });
  revalidatePath(`/initiatives/${prev.initiativeId}`);
  revalidatePath(`/epics/${id}`);
  return { ok: true as const, id };
}

export async function deleteEpic(id: string) {
  const user = await assertCanWrite();
  const e = await prisma.epic.findUniqueOrThrow({ where: { id } });
  await prisma.epic.delete({ where: { id } });
  await logActivity({
    itemType: "EPIC",
    itemId: id,
    actorId: user.id,
    kind: "DELETED",
    summary: `Deleted epic "${e.name}"`,
  });
  revalidatePath(`/initiatives/${e.initiativeId}`);
  return { ok: true as const };
}
