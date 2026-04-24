import { headers } from "next/headers";
import { redirect } from "next/navigation";
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

/** Reject path traversal or absolute URLs. */
function safeAppPath(path: string, search: string): string {
  const full = (path + search) || "/dashboard";
  if (!full.startsWith("/") || full.startsWith("//")) return "/dashboard";
  return full.length > 2000 ? "/dashboard" : full;
}

/**
 * For session expiry or missing auth, redirect to sign-in with context instead of
 * throwing (which surfaces as opaque errors/404s in some flows).
 */
async function redirectToLogin() {
  const h = await headers();
  const referer = h.get("referer");
  let callback = "/dashboard";
  if (referer) {
    try {
      const appOrigin =
        process.env.AUTH_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
        process.env.NEXTAUTH_URL ||
        "http://localhost:3000";
      const u = new URL(referer);
      const origin = new URL(appOrigin);
      if (u.origin === origin.origin) {
        callback = safeAppPath(u.pathname, u.search);
      }
    } catch {
      /* keep default */
    }
  }
  const qs = new URLSearchParams({ reason: "session_expired" });
  qs.set("callbackUrl", callback);
  redirect(`/login?${qs.toString()}`);
}

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) {
    await redirectToLogin();
  }
  return (session as NonNullable<typeof session>).user as SessionUser;
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
  if (!canWrite(user)) {
    redirect("/dashboard?reason=read_only");
  }
  return user;
}
