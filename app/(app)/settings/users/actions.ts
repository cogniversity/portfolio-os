"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import type { Role } from "@/lib/auth-types";

export async function setUserRolesAction(userId: string, roles: Role[]) {
  await requireRole("PRODUCT_MANAGER");
  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId } }),
    prisma.userRole.createMany({
      data: roles.map((role) => ({ userId, role })),
    }),
  ]);
  revalidatePath("/settings/users");
  return { ok: true as const };
}
