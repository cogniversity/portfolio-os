"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CircleUser,
  Map,
  KanbanSquare,
  Calendar,
  FolderKanban,
  Package,
  Rocket,
  Target,
  FileBarChart2,
  Settings,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth-types";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: Array<"LEADER" | "PRODUCT_MANAGER" | "TEAM_MEMBER">;
};

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/my-work", label: "My Work", icon: CircleUser },
      { href: "/roadmap", label: "Roadmap", icon: Map },
      { href: "/kanban", label: "Kanban", icon: KanbanSquare },
      { href: "/calendar", label: "Calendar", icon: Calendar },
    ],
  },
  {
    section: "Hierarchy",
    items: [
      { href: "/portfolios", label: "Portfolios", icon: FolderKanban },
      { href: "/products", label: "Products", icon: Package },
      { href: "/initiatives", label: "Initiatives", icon: Target },
      { href: "/releases", label: "Releases", icon: Rocket },
    ],
  },
  {
    section: "Reports",
    items: [{ href: "/reports", label: "Reports", icon: FileBarChart2 }],
  },
  {
    section: "Admin",
    items: [
      {
        href: "/settings",
        label: "Settings",
        icon: Settings,
        roles: ["PRODUCT_MANAGER"],
      },
    ],
  },
];

export function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const roles = user.roles ?? [];

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-card md:flex md:flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Rocket className="h-4 w-4" />
        </div>
        <div className="text-sm font-semibold tracking-tight">Portfolio OS</div>
      </div>
      <nav className="flex-1 overflow-auto px-2 py-3">
        {NAV.map((group) => {
          const visible = group.items.filter(
            (item) => !item.roles || item.roles.some((r) => roles.includes(r)),
          );
          if (visible.length === 0) return null;
          return (
            <div key={group.section} className="mb-4">
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.section}
              </div>
              <ul className="space-y-0.5">
                {visible.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.href ||
                    (item.href !== "/dashboard" &&
                      pathname.startsWith(item.href));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                          active
                            ? "bg-accent font-medium text-accent-foreground"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="border-t p-3 text-[10px] text-muted-foreground">
        Phase 1 · v0.1
      </div>
    </aside>
  );
}
