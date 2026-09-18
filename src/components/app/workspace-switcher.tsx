"use client";

import { ChevronsUpDown, Check, Plus } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { switchWorkspace } from "@/features/workspace/actions";
import { useT } from "@/lib/i18n/client";
import { initials } from "@/lib/utils/format";
import type { WorkspaceRole } from "@/types/common";

export interface WorkspaceOption {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
}

export interface WorkspaceSwitcherProps {
  currentId: string;
  workspaces: WorkspaceOption[];
}

/**
 * Switches the active workspace through a server action that re-verifies
 * membership. The client never sends a workspace id that is trusted as-is.
 */
export function WorkspaceSwitcher({ currentId, workspaces }: WorkspaceSwitcherProps) {
  const t = useT("nav");
  const tc = useT("common");
  const [pending, startTransition] = useTransition();
  const current = workspaces.find((workspace) => workspace.id === currentId) ?? workspaces[0];

  function select(id: string) {
    if (id === currentId) return;
    startTransition(async () => {
      const result = await switchWorkspace(id);
      if (result && !result.ok) toast.error(result.error.message);
    });
  }

  if (!current) return null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                disabled={pending}
                aria-label={t("switchWorkspace")}
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              />
            }
          >
            <Avatar size="sm" className="rounded-md">
              <AvatarFallback className="rounded-md bg-primary/12 text-[0.7rem] font-semibold text-primary">{initials(current.name)}</AvatarFallback>
            </Avatar>
            <span className="grid min-w-0 flex-1 text-left leading-tight">
              <span className="truncate text-sm font-medium">{current.name}</span>
              <span className="truncate text-xs text-muted-foreground">{tc(`roles.${current.role}`)}</span>
            </span>
            <ChevronsUpDown className="ml-auto opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="bottom" className="w-64">
            <DropdownMenuLabel>{t("workspace")}</DropdownMenuLabel>
            {workspaces.map((workspace) => (
              <DropdownMenuItem key={workspace.id} onClick={() => select(workspace.id)} disabled={pending}>
                <Avatar size="sm" className="rounded-md">
                  <AvatarFallback className="rounded-md text-[0.7rem]">{initials(workspace.name)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                {workspace.id === currentId ? <Check className="size-3.5" /> : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/onboarding?new=1" />}>
              <Plus />
              {t("createWorkspace")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
