"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCanWrite } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { baseItemSchema } from "@/lib/zod-schemas";

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
