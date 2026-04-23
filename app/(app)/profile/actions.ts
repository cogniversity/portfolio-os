"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/rbac";

const schema = z.object({
  fullName: z.string().min(1).max(120),
  avatarUrl: z.string().url().nullable(),
  teamId: z.string().nullable(),
  newTeamName: z.string().min(1).max(80).nullable(),
});

export async function updateProfileAction(input: z.input<typeof schema>) {
  const user = await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid input" };
  }
  const { fullName, avatarUrl, teamId, newTeamName } = parsed.data;

  let finalTeamId = teamId;
  if (newTeamName) {
    const team = await prisma.team.upsert({
      where: { name: newTeamName },
      update: {},
      create: { name: newTeamName },
    });
    finalTeamId = team.id;
  }

  await prisma.profile.upsert({
    where: { userId: user.id },
    update: { fullName, avatarUrl, teamId: finalTeamId },
    create: {
      userId: user.id,
      fullName,
      avatarUrl,
      teamId: finalTeamId,
    },
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { name: fullName, image: avatarUrl },
  });
  revalidatePath("/profile");
  return { ok: true as const };
}
