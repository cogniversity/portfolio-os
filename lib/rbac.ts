import { auth } from "@/lib/auth";
import type { Role, SessionUser } from "@/lib/auth-types";

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  return session.user as SessionUser;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  const has = user.roles?.some((r) => roles.includes(r));
  if (!has) throw new ForbiddenError();
  return user;
}

export function hasRole(user: SessionUser | null | undefined, ...roles: Role[]) {
  if (!user) return false;
  return user.roles?.some((r) => roles.includes(r)) ?? false;
}

export function canWrite(user: SessionUser | null | undefined) {
  return hasRole(user, "PRODUCT_MANAGER");
}

export function canWriteAssigned(
  user: SessionUser | null | undefined,
  ownerId: string | null | undefined,
  assigneeId: string | null | undefined,
) {
  if (!user) return false;
  if (hasRole(user, "PRODUCT_MANAGER")) return true;
  if (hasRole(user, "TEAM_MEMBER")) {
    return user.id === ownerId || user.id === assigneeId;
  }
  return false;
}

export function isLeaderOnly(user: SessionUser) {
  return hasRole(user, "LEADER") && !hasRole(user, "PRODUCT_MANAGER");
}

export async function assertCanWrite() {
  const user = await requireUser();
  if (!canWrite(user)) throw new ForbiddenError("Write access denied");
  return user;
}
