import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { Role } from "@/lib/auth-types";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const providers = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

providers.push(
  Credentials({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(raw) {
      const parsed = credentialsSchema.safeParse(raw);
      if (!parsed.success) return null;
      const { email, password } = parsed.data;
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        include: { roles: true },
      });
      if (!user?.passwordHash) return null;
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return null;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        roles: user.roles.map((r) => r.role),
      };
    },
  }),
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.roles = (user as any).roles ?? [];
      }
      if (token.id && !token.roles) {
        const roles = await prisma.userRole.findMany({
          where: { userId: token.id as string },
        });
        token.roles = roles.map((r) => r.role) as Role[];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as any).id = token.id;
        (session.user as any).roles = token.roles ?? [];
      }
      return session;
    },
    async signIn({ user, account }) {
      // For OAuth users, ensure profile + default role exist
      if (account?.provider === "google" && user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          include: { roles: true, profile: true },
        });
        if (dbUser && dbUser.roles.length === 0) {
          await prisma.userRole.create({
            data: { userId: dbUser.id, role: "TEAM_MEMBER" },
          });
        }
        if (dbUser && !dbUser.profile) {
          await prisma.profile.create({
            data: {
              userId: dbUser.id,
              fullName: user.name ?? user.email.split("@")[0],
              avatarUrl: user.image ?? null,
            },
          });
        }
      }
      return true;
    },
  },
});
