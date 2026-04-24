"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCanWrite } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { baseItemSchema, priorityEnum, workStatusEnum } from "@/lib/zod-schemas";

const epicSchema = baseItemSchema
  .extend({
    initiativeId: z.string().nullable().optional(),
    productId: z.string().nullable().optional(),
  })
  .refine((d) => Boolean(d.initiativeId) || Boolean(d.productId), {
    message: "Epic must have at least one of initiative or product",
    path: ["initiativeId"],
  });

function normalizeParent(v: string | null | undefined): string | null {
  return v && v.length > 0 ? v : null;
}

export async function createEpic(input: z.input<typeof epicSchema>) {
  const user = await assertCanWrite();
  const parsed = epicSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const d = parsed.data;
  const initiativeId = normalizeParent(d.initiativeId);
  const productId = normalizeParent(d.productId);
  const count = await prisma.epic.count({
    where: initiativeId ? { initiativeId } : { productId: productId ?? undefined },
  });
  const e = await prisma.epic.create({
    data: {
      initiativeId,
      productId,
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
  const parentLabel = initiativeId
    ? productId
      ? "initiative + product"
      : "initiative"
    : "product";
  await logActivity({
    itemType: "EPIC",
    itemId: e.id,
    actorId: user.id,
    kind: "CREATED",
    summary: `Created epic "${e.name}" under ${parentLabel}`,
  });
  if (initiativeId) revalidatePath(`/initiatives/${initiativeId}`);
  if (productId) revalidatePath(`/products/${productId}`);
  revalidatePath(`/epics/${e.id}`);
  return { ok: true as const, id: e.id };
}

export async function updateEpic(id: string, input: z.input<typeof epicSchema>) {
  const user = await assertCanWrite();
  const parsed = epicSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const d = parsed.data;
  const initiativeId = normalizeParent(d.initiativeId);
  const productId = normalizeParent(d.productId);
  const prev = await prisma.epic.findUniqueOrThrow({ where: { id } });
  const next = await prisma.epic.update({
    where: { id },
    data: {
      initiativeId,
      productId,
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
  if (prev.initiativeId) revalidatePath(`/initiatives/${prev.initiativeId}`);
  if (prev.productId) revalidatePath(`/products/${prev.productId}`);
  if (initiativeId && initiativeId !== prev.initiativeId)
    revalidatePath(`/initiatives/${initiativeId}`);
  if (productId && productId !== prev.productId) revalidatePath(`/products/${productId}`);
  revalidatePath(`/epics/${id}`);
  return { ok: true as const, id };
}

const clearableDate = z
  .union([z.null(), z.string(), z.date()])
  .transform((v) => {
    if (v === null || v === "") return null;
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? null : d;
  });

const epicBulkPatchSchema = z
  .object({
    ownerId: z.string().nullable().optional(),
    startDate: clearableDate.optional(),
    targetDate: clearableDate.optional(),
    status: workStatusEnum.optional(),
    priority: priorityEnum.optional(),
  })
  .refine(
    (p) =>
      p.ownerId !== undefined ||
      p.startDate !== undefined ||
      p.targetDate !== undefined ||
      p.status !== undefined ||
      p.priority !== undefined,
    { message: "At least one field is required" },
  );

export async function bulkUpdateEpics(
  input: {
    epicIds: string[];
    /** When set, every epic must belong to this initiative (stricter than plain id list). */
    initiativeId?: string;
    /** When set, every epic must be linked to this product. */
    productId?: string;
  } & z.input<typeof epicBulkPatchSchema>,
) {
  const user = await assertCanWrite();
  const { epicIds, initiativeId, productId, ...rawPatch } = input;
  const parsed = epicBulkPatchSchema.safeParse(rawPatch);
  if (!parsed.success) return { ok: false as const, error: "Nothing to update" };
  const patch = parsed.data;
  if (epicIds.length === 0) return { ok: false as const, error: "No epics selected" };

  const epics = await prisma.epic.findMany({
    where: {
      id: { in: epicIds },
      ...(initiativeId !== undefined ? { initiativeId } : {}),
      ...(productId !== undefined ? { productId } : {}),
    },
  });
  if (epics.length !== epicIds.length) {
    return {
      ok: false as const,
      error: "One or more epics were not found, or are not in this scope",
    };
  }

  const data: Record<string, unknown> = {};
  if (patch.ownerId !== undefined) data.ownerId = patch.ownerId;
  if (patch.startDate !== undefined) data.startDate = patch.startDate;
  if (patch.targetDate !== undefined) data.targetDate = patch.targetDate;
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.priority !== undefined) data.priority = patch.priority;

  await prisma.$transaction(
    epicIds.map((id) =>
      prisma.epic.update({
        where: { id },
        data,
      }),
    ),
  );

  const after = await prisma.epic.findMany({ where: { id: { in: epicIds } } });
  const byId = new Map(after.map((e) => [e.id, e]));
  for (const e of epics) {
    const next = byId.get(e.id);
    if (!next) continue;
    await logActivity({
      itemType: "EPIC",
      itemId: e.id,
      actorId: user.id,
      kind: "UPDATED",
      summary: `Bulk update (${Object.keys(data).join(", ")})`,
      diff: { prev: e, next },
    });
    if (e.initiativeId) revalidatePath(`/initiatives/${e.initiativeId}`);
    if (e.productId) revalidatePath(`/products/${e.productId}`);
    revalidatePath(`/epics/${e.id}`);
  }

  return { ok: true as const, count: epicIds.length };
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
  if (e.initiativeId) revalidatePath(`/initiatives/${e.initiativeId}`);
  if (e.productId) revalidatePath(`/products/${e.productId}`);
  return { ok: true as const };
}
