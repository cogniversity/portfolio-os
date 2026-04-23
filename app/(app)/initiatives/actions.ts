"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCanWrite } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { baseItemSchema } from "@/lib/zod-schemas";

const initiativeSchema = baseItemSchema.extend({
  typeId: z.string().nullable().optional(),
  productIds: z.array(z.string()).default([]),
  customFields: z.record(z.string(), z.any()).optional(),
});

export async function createInitiative(input: z.input<typeof initiativeSchema>) {
  const user = await assertCanWrite();
  const parsed = initiativeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const d = parsed.data;
  const count = await prisma.initiative.count();
  const init = await prisma.initiative.create({
    data: {
      name: d.name,
      description: d.description ?? null,
      ownerId: d.ownerId ?? null,
      status: d.status,
      priority: d.priority,
      startDate: d.startDate ?? null,
      targetDate: d.targetDate ?? null,
      typeId: d.typeId ?? null,
      orderIndex: count,
      products: {
        create: d.productIds.map((productId) => ({ productId })),
      },
    },
  });
  if (d.customFields && d.typeId) {
    const defs = await prisma.customFieldDefinition.findMany({
      where: { typeId: d.typeId },
    });
    const values = defs
      .filter((def) => def.key in (d.customFields ?? {}))
      .map((def) => ({
        initiativeId: init.id,
        definitionId: def.id,
        value: d.customFields![def.key] ?? null,
      }));
    if (values.length > 0) {
      await prisma.customFieldValue.createMany({ data: values as any });
    }
  }
  await logActivity({
    itemType: "INITIATIVE",
    itemId: init.id,
    actorId: user.id,
    kind: "CREATED",
    summary: `Created initiative "${init.name}"`,
  });
  revalidatePath("/initiatives");
  return { ok: true as const, id: init.id };
}

export async function updateInitiative(
  id: string,
  input: z.input<typeof initiativeSchema>,
) {
  const user = await assertCanWrite();
  const parsed = initiativeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const d = parsed.data;
  const prev = await prisma.initiative.findUniqueOrThrow({ where: { id } });
  const next = await prisma.initiative.update({
    where: { id },
    data: {
      name: d.name,
      description: d.description ?? null,
      ownerId: d.ownerId ?? null,
      status: d.status,
      priority: d.priority,
      startDate: d.startDate ?? null,
      targetDate: d.targetDate ?? null,
      typeId: d.typeId ?? null,
      products: {
        deleteMany: {},
        create: d.productIds.map((productId) => ({ productId })),
      },
    },
  });
  if (d.customFields && d.typeId) {
    const defs = await prisma.customFieldDefinition.findMany({
      where: { typeId: d.typeId },
    });
    for (const def of defs) {
      if (def.key in (d.customFields ?? {})) {
        await prisma.customFieldValue.upsert({
          where: {
            initiativeId_definitionId: { initiativeId: id, definitionId: def.id },
          },
          create: {
            initiativeId: id,
            definitionId: def.id,
            value: d.customFields![def.key] ?? null,
          },
          update: { value: d.customFields![def.key] ?? null },
        });
      }
    }
  }
  await logActivity({
    itemType: "INITIATIVE",
    itemId: id,
    actorId: user.id,
    kind: "UPDATED",
    summary: `Updated initiative "${next.name}"`,
    diff: { prev, next },
  });
  revalidatePath("/initiatives");
  revalidatePath(`/initiatives/${id}`);
  return { ok: true as const, id };
}

export async function deleteInitiative(id: string) {
  const user = await assertCanWrite();
  const i = await prisma.initiative.findUniqueOrThrow({ where: { id } });
  await prisma.initiative.delete({ where: { id } });
  await logActivity({
    itemType: "INITIATIVE",
    itemId: id,
    actorId: user.id,
    kind: "DELETED",
    summary: `Deleted initiative "${i.name}"`,
  });
  revalidatePath("/initiatives");
  return { ok: true as const };
}
