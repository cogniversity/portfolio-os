"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCanWrite } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { nullableDate, releaseStatusEnum } from "@/lib/zod-schemas";

const releaseSchema = z.object({
  productId: z.string(),
  name: z.string().min(1).max(200),
  version: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  status: releaseStatusEnum.default("PLANNED"),
  plannedDate: nullableDate,
  actualDate: nullableDate,
});

export async function createRelease(input: z.input<typeof releaseSchema>) {
  const user = await assertCanWrite();
  const parsed = releaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const d = parsed.data;
  const count = await prisma.release.count({ where: { productId: d.productId } });
  const r = await prisma.release.create({
    data: {
      productId: d.productId,
      name: d.name,
      version: d.version ?? null,
      description: d.description ?? null,
      status: d.status,
      plannedDate: d.plannedDate ?? null,
      actualDate: d.actualDate ?? null,
      orderIndex: count,
    },
  });
  await logActivity({
    itemType: "RELEASE",
    itemId: r.id,
    actorId: user.id,
    kind: "CREATED",
    summary: `Created release "${r.name}"`,
  });
  revalidatePath("/releases");
  revalidatePath(`/products/${d.productId}`);
  return { ok: true as const, id: r.id };
}

export async function updateRelease(
  id: string,
  input: z.input<typeof releaseSchema>,
) {
  const user = await assertCanWrite();
  const parsed = releaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const d = parsed.data;
  const prev = await prisma.release.findUniqueOrThrow({ where: { id } });
  const next = await prisma.release.update({
    where: { id },
    data: {
      productId: d.productId,
      name: d.name,
      version: d.version ?? null,
      description: d.description ?? null,
      status: d.status,
      plannedDate: d.plannedDate ?? null,
      actualDate: d.actualDate ?? null,
    },
  });
  await logActivity({
    itemType: "RELEASE",
    itemId: id,
    actorId: user.id,
    kind: "UPDATED",
    summary: `Updated release "${next.name}"`,
    diff: { prev, next },
  });
  revalidatePath("/releases");
  revalidatePath(`/releases/${id}`);
  return { ok: true as const, id };
}

export async function deleteRelease(id: string) {
  const user = await assertCanWrite();
  const r = await prisma.release.findUniqueOrThrow({ where: { id } });
  await prisma.release.delete({ where: { id } });
  await logActivity({
    itemType: "RELEASE",
    itemId: id,
    actorId: user.id,
    kind: "DELETED",
    summary: `Deleted release "${r.name}"`,
  });
  revalidatePath("/releases");
  return { ok: true as const };
}

export async function toggleEpicInRelease(
  releaseId: string,
  epicId: string,
  add: boolean,
) {
  const user = await assertCanWrite();
  if (add) {
    await prisma.releaseEpic.upsert({
      where: { releaseId_epicId: { releaseId, epicId } },
      create: { releaseId, epicId },
      update: {},
    });
  } else {
    await prisma.releaseEpic.deleteMany({
      where: { releaseId, epicId },
    });
  }
  await logActivity({
    itemType: "RELEASE",
    itemId: releaseId,
    actorId: user.id,
    kind: add ? "RELEASE_ADDED" : "RELEASE_REMOVED",
    summary: `${add ? "Added" : "Removed"} epic ${epicId}`,
    diff: { epicId, add },
  });
  revalidatePath(`/releases/${releaseId}`);
  return { ok: true as const };
}

export async function toggleStoryInRelease(
  releaseId: string,
  storyId: string,
  add: boolean,
) {
  const user = await assertCanWrite();
  if (add) {
    await prisma.releaseStory.upsert({
      where: { releaseId_storyId: { releaseId, storyId } },
      create: { releaseId, storyId },
      update: {},
    });
  } else {
    await prisma.releaseStory.deleteMany({
      where: { releaseId, storyId },
    });
  }
  await logActivity({
    itemType: "RELEASE",
    itemId: releaseId,
    actorId: user.id,
    kind: add ? "RELEASE_ADDED" : "RELEASE_REMOVED",
    summary: `${add ? "Added" : "Removed"} story ${storyId}`,
    diff: { storyId, add },
  });
  revalidatePath(`/releases/${releaseId}`);
  return { ok: true as const };
}
