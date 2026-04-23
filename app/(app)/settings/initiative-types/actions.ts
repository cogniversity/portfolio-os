"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { slugify } from "@/lib/utils";

const fieldSchema = z.object({
  id: z.string().optional(),
  key: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(["TEXT", "NUMBER", "DATE", "SELECT", "TEXTAREA", "CUSTOMER_LINK"]),
  options: z.any().optional(),
  required: z.boolean().default(false),
});

const typeSchema = z.object({
  name: z.string().min(1).max(80),
  color: z.string().default("#6366f1"),
  fields: z.array(fieldSchema).default([]),
});

export async function createInitiativeType(input: z.input<typeof typeSchema>) {
  await requireRole("PRODUCT_MANAGER");
  const parsed = typeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const d = parsed.data;
  const key = slugify(d.name);
  const t = await prisma.initiativeType.create({
    data: {
      key,
      name: d.name,
      color: d.color,
      isBuiltIn: false,
      fields: {
        create: d.fields.map((f, i) => ({
          key: f.key || slugify(f.label),
          label: f.label,
          kind: f.kind,
          options: f.options ?? null,
          required: f.required,
          orderIndex: i,
        })),
      },
    },
  });
  revalidatePath("/settings/initiative-types");
  return { ok: true as const, id: t.id };
}

export async function updateInitiativeType(id: string, input: z.input<typeof typeSchema>) {
  await requireRole("PRODUCT_MANAGER");
  const parsed = typeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const d = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.initiativeType.update({
      where: { id },
      data: { name: d.name, color: d.color },
    });
    const existing = await tx.customFieldDefinition.findMany({ where: { typeId: id } });
    const keepIds = new Set(d.fields.map((f) => f.id).filter(Boolean) as string[]);
    const toDelete = existing.filter((e) => !keepIds.has(e.id)).map((e) => e.id);
    if (toDelete.length > 0) {
      await tx.customFieldDefinition.deleteMany({ where: { id: { in: toDelete } } });
    }
    for (let i = 0; i < d.fields.length; i++) {
      const f = d.fields[i];
      if (f.id) {
        await tx.customFieldDefinition.update({
          where: { id: f.id },
          data: {
            key: f.key,
            label: f.label,
            kind: f.kind,
            options: f.options ?? null,
            required: f.required,
            orderIndex: i,
          },
        });
      } else {
        await tx.customFieldDefinition.create({
          data: {
            typeId: id,
            key: f.key || slugify(f.label),
            label: f.label,
            kind: f.kind,
            options: f.options ?? null,
            required: f.required,
            orderIndex: i,
          },
        });
      }
    }
  });

  revalidatePath("/settings/initiative-types");
  revalidatePath(`/settings/initiative-types/${id}`);
  return { ok: true as const, id };
}

export async function deleteInitiativeType(id: string) {
  await requireRole("PRODUCT_MANAGER");
  const type = await prisma.initiativeType.findUnique({ where: { id } });
  if (!type) return { ok: false as const, error: "Not found" };
  if (type.isBuiltIn) return { ok: false as const, error: "Cannot delete built-in type" };
  await prisma.initiativeType.delete({ where: { id } });
  revalidatePath("/settings/initiative-types");
  return { ok: true as const };
}
