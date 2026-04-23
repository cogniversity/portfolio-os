"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCanWrite, requireUser } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { baseItemSchema } from "@/lib/zod-schemas";

export async function createPortfolio(input: z.input<typeof baseItemSchema>) {
  const user = await assertCanWrite();
  const parsed = baseItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const data = parsed.data;
  const count = await prisma.portfolio.count();
  const portfolio = await prisma.portfolio.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      ownerId: data.ownerId ?? null,
      status: data.status,
      priority: data.priority,
      startDate: data.startDate ?? null,
      targetDate: data.targetDate ?? null,
      orderIndex: count,
    },
  });
  await logActivity({
    itemType: "PORTFOLIO",
    itemId: portfolio.id,
    actorId: user.id,
    kind: "CREATED",
    summary: `Created portfolio "${portfolio.name}"`,
  });
  revalidatePath("/portfolios");
  return { ok: true as const, id: portfolio.id };
}

export async function updatePortfolio(
  id: string,
  input: z.input<typeof baseItemSchema>,
) {
  const user = await assertCanWrite();
  const parsed = baseItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const data = parsed.data;
  const prev = await prisma.portfolio.findUniqueOrThrow({ where: { id } });
  const next = await prisma.portfolio.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description ?? null,
      ownerId: data.ownerId ?? null,
      status: data.status,
      priority: data.priority,
      startDate: data.startDate ?? null,
      targetDate: data.targetDate ?? null,
    },
  });
  await logActivity({
    itemType: "PORTFOLIO",
    itemId: id,
    actorId: user.id,
    kind: "UPDATED",
    summary: `Updated portfolio "${next.name}"`,
    diff: { prev, next },
  });
  revalidatePath("/portfolios");
  revalidatePath(`/portfolios/${id}`);
  return { ok: true as const, id };
}

export async function deletePortfolio(id: string) {
  const user = await assertCanWrite();
  const p = await prisma.portfolio.findUniqueOrThrow({ where: { id } });
  await prisma.portfolio.delete({ where: { id } });
  await logActivity({
    itemType: "PORTFOLIO",
    itemId: id,
    actorId: user.id,
    kind: "DELETED",
    summary: `Deleted portfolio "${p.name}"`,
  });
  revalidatePath("/portfolios");
  return { ok: true as const };
}
