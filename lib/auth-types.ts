import type { UserRoleType } from "@prisma/client";

export type Role = UserRoleType;

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  roles: Role[];
};

declare module "next-auth" {
  interface Session {
    user: SessionUser;
  }
  interface User {
    roles?: Role[];
  }
}

