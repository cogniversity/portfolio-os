import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const user = await requireUser();
  const [profile, teams] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId: user.id },
      include: { team: true },
    }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="container max-w-2xl py-8">
      <Card>
        <CardHeader>
          <CardTitle>Your profile</CardTitle>
          <CardDescription>Update your name, avatar, and team.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            initial={{
              fullName: profile?.fullName ?? user.name ?? "",
              avatarUrl: profile?.avatarUrl ?? "",
              teamId: profile?.teamId ?? "",
            }}
            teams={teams}
          />
        </CardContent>
      </Card>
    </div>
  );
}
