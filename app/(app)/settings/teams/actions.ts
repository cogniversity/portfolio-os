"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

export async function createTeamAction(name: string) {
  await requireRole("PRODUCT_MANAGER");
  const n = name.trim();
  if (!n) return { ok: false as const, error: "Name required" };
  try {
    await prisma.team.create({ data: { name: n } });
  } catch {
    return { ok: false as const, error: "Team already exists" };
  }
  revalidatePath("/settings/teams");
  return { ok: true as const };
}

export async function deleteTeamAction(id: string) {
  await requireRole("PRODUCT_MANAGER");
  await prisma.team.delete({ where: { id } });
  revalidatePath("/settings/teams");
  return { ok: true as const };
}
