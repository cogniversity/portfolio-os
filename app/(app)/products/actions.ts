"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCanWrite } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { baseItemSchema } from "@/lib/zod-schemas";

const productSchema = baseItemSchema.extend({
  portfolioId: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
});

export async function createProduct(input: z.input<typeof productSchema>) {
  const user = await assertCanWrite();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const d = parsed.data;
  const count = await prisma.product.count();
  const p = await prisma.product.create({
    data: {
      name: d.name,
      description: d.description ?? null,
      ownerId: d.ownerId ?? null,
      status: d.status,
      priority: d.priority,
      startDate: d.startDate ?? null,
      targetDate: d.targetDate ?? null,
      portfolioId: d.portfolioId ?? null,
      color: d.color ?? null,
      orderIndex: count,
    },
  });
  await logActivity({
    itemType: "PRODUCT",
    itemId: p.id,
    actorId: user.id,
    kind: "CREATED",
    summary: `Created product "${p.name}"`,
  });
  revalidatePath("/products");
  return { ok: true as const, id: p.id };
}

export async function updateProduct(
  id: string,
  input: z.input<typeof productSchema>,
) {
  const user = await assertCanWrite();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const d = parsed.data;
  const prev = await prisma.product.findUniqueOrThrow({ where: { id } });
  const next = await prisma.product.update({
    where: { id },
    data: {
      name: d.name,
      description: d.description ?? null,
      ownerId: d.ownerId ?? null,
      status: d.status,
      priority: d.priority,
      startDate: d.startDate ?? null,
      targetDate: d.targetDate ?? null,
      portfolioId: d.portfolioId ?? null,
      color: d.color ?? null,
    },
  });
  await logActivity({
    itemType: "PRODUCT",
    itemId: id,
    actorId: user.id,
    kind: "UPDATED",
    summary: `Updated product "${next.name}"`,
    diff: { prev, next },
  });
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  return { ok: true as const, id };
}

export async function deleteProduct(id: string) {
  const user = await assertCanWrite();
  const p = await prisma.product.findUniqueOrThrow({ where: { id } });
  await prisma.product.delete({ where: { id } });
  await logActivity({
    itemType: "PRODUCT",
    itemId: id,
    actorId: user.id,
    kind: "DELETED",
    summary: `Deleted product "${p.name}"`,
  });
  revalidatePath("/products");
  return { ok: true as const };
}
