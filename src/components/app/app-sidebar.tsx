"use client";

import {
  Building2,
  ChartColumn,
  FileText,
  Kanban,
  LayoutDashboard,
  MessagesSquare,
  Radar,
  Settings,
  ShieldCheck,
  SquarePlus,
  Target,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useT } from "@/lib/i18n/client";

import { BrandLockup } from "./logo";
import { UserMenu } from "./user-menu";
import { WorkspaceSwitcher, type WorkspaceOption } from "./workspace-switcher";

interface NavItem {
  href: string;
  /** Key in the `nav` namespace. */
  labelKey: string;
  icon: LucideIcon;
  /** Emphasised entry point (the primary call to action). */
  highlight?: boolean;
}

interface NavGroup {
  id: string;
  /** Key in `nav.groups`; omitted for the ungrouped top block. */
  labelKey?: string;
  items: NavItem[];
  platformAdminOnly?: boolean;
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    items: [{ href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard }],
  },
  {
    id: "discover",
    labelKey: "groups.discover",
    items: [
      { href: "/scans/new", labelKey: "newScan", icon: SquarePlus, highlight: true },
      { href: "/scans", labelKey: "scans", icon: Radar },
      { href: "/opportunities", labelKey: "opportunities", icon: Target },
      { href: "/businesses", labelKey: "businesses", icon: Building2 },
    ],
  },
  {
    id: "outreach",
    labelKey: "groups.outreach",
    items: [
      { href: "/pipeline", labelKey: "pipeline", icon: Kanban },
      { href: "/messages", labelKey: "messages", icon: MessagesSquare },
      { href: "/templates", labelKey: "templates", icon: FileText },
    ],
  },
  {
    id: "insights",
    labelKey: "groups.insights",
    items: [{ href: "/analytics", labelKey: "analytics", icon: ChartColumn }],
  },
  {
    id: "workspace",
    labelKey: "groups.workspace",
    items: [{ href: "/settings", labelKey: "settings", icon: Settings }],
  },
  {
    id: "platform",
    labelKey: "groups.platform",
    platformAdminOnly: true,
    items: [{ href: "/admin", labelKey: "admin", icon: ShieldCheck }],
  },
];

/** Longest matching href wins, so /scans/new does not also light up /scans. */
function resolveActiveHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    const matches = pathname === href || pathname.startsWith(`${href}/`);
    if (matches && (best === null || href.length > best.length)) best = href;
  }
  return best;
}

export interface AppSidebarProps {
  currentWorkspaceId: string;
  workspaces: WorkspaceOption[];
  user: { displayName: string | null; email: string | null; avatarUrl: string | null };
  isPlatformAdmin: boolean;
}

export function AppSidebar({ currentWorkspaceId, workspaces, user, isPlatformAdmin }: AppSidebarProps) {
  const t = useT("nav");
  const pathname = usePathname();
  const groups = NAV_GROUPS.filter((group) => !group.platformAdminOnly || isPlatformAdmin);
  const activeHref = resolveActiveHref(pathname, groups.flatMap((group) => group.items.map((item) => item.href)));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-2">
        <Link
          href="/dashboard"
          className="flex h-8 items-center gap-2 px-1 outline-none group-data-[collapsible=icon]:justify-center focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <BrandLockup size={22} className="group-data-[collapsible=icon]:[&>span:last-child]:hidden" />
        </Link>
        <WorkspaceSwitcher currentId={currentWorkspaceId} workspaces={workspaces} />
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.id}>
            {group.labelKey ? <SidebarGroupLabel>{t(group.labelKey)}</SidebarGroupLabel> : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const label = t(item.labelKey);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={activeHref === item.href}
                        tooltip={label}
                        className={item.highlight ? "text-sidebar-primary" : undefined}
                        render={<Link href={item.href} />}
                      >
                        <Icon />
                        <span>{label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarSeparator className="mb-1" />
        <UserMenu displayName={user.displayName} email={user.email} avatarUrl={user.avatarUrl} isPlatformAdmin={isPlatformAdmin} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
