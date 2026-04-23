import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { PageHeader } from "@/components/work/page-header";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Palette, Users, ListChecks } from "lucide-react";

export default async function SettingsPage() {
  await requireRole("PRODUCT_MANAGER");
  return (
    <div>
      <PageHeader title="Settings" description="Configure types, roles, and workspace." />
      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
        <SettingCard
          href="/settings/initiative-types"
          icon={<Palette className="h-5 w-5" />}
          title="Initiative Types"
          description="Manage built-in types and custom fields for initiatives."
        />
        <SettingCard
          href="/settings/users"
          icon={<Users className="h-5 w-5" />}
          title="Users & Roles"
          description="Assign roles and manage team memberships."
        />
        <SettingCard
          href="/settings/teams"
          icon={<ListChecks className="h-5 w-5" />}
          title="Teams"
          description="Organize people into teams for reporting and assignments."
        />
      </div>
    </div>
  );
}

function SettingCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:bg-accent/40">
        <CardContent className="flex items-start gap-3 pt-6">
          <div className="mt-0.5 text-primary">{icon}</div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
