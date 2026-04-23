"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { Role } from "@/lib/auth-types";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1).max(120),
  role: z.enum(["LEADER", "PRODUCT_MANAGER", "TEAM_MEMBER"]),
});

export async function signupAction(input: {
  email: string;
  password: string;
  fullName: string;
  role: Role;
}) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid input" };
  }
  const { email, password, fullName, role } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false as const, error: "An account with this email already exists" };
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email,
      name: fullName,
      passwordHash,
      profile: { create: { fullName } },
      roles: { create: { role } },
    },
  });
  return { ok: true as const };
}
