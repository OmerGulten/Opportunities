"use client";

import { Link2, Mail, UserMinus, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog, CopyButton, DataTable, InlineAlert, type DataTableColumn } from "@/components/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { changeMemberRole, createInvitation, removeTeamMember } from "@/features/settings/actions";
import { useFormatters, useT } from "@/lib/i18n/client";
import type { WorkspaceRole } from "@/types/common";

export interface TeamMemberItem {
  userId: string;
  role: WorkspaceRole;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  joinedAt: string;
  isOwner: boolean;
}

export interface TeamManagerProps {
  members: TeamMemberItem[];
  currentUserId: string;
  /** Admins and the owner may invite, change roles and remove members. */
  canManage: boolean;
  /** Only the owner can hand out the owner role. */
  canGrantOwner: boolean;
}

interface CreatedInvitation {
  email: string;
  role: WorkspaceRole;
  inviteUrl: string;
  expiresAt: string;
}

const ASSIGNABLE_ROLES: WorkspaceRole[] = ["admin", "member"];

export function TeamManager({ members, currentUserId, canManage, canGrantOwner }: TeamManagerProps) {
  const t = useT("settings");
  const tc = useT("common");
  const router = useRouter();
  const { date } = useFormatters();
  const [pending, startTransition] = useTransition();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<CreatedInvitation | null>(null);

  function invite() {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setInviteError(t("errors.invalidEmail"));
      return;
    }
    setInviteError(null);

    startTransition(async () => {
      const result = await createInvitation({ email: trimmed, role });
      if (!result.ok) {
        setInviteError(result.error.message);
        toast.error(result.error.message);
        return;
      }
      setInvitation({
        email: result.data.email,
        role: result.data.role,
        inviteUrl: result.data.inviteUrl,
        expiresAt: result.data.expiresAt,
      });
      setEmail("");
      toast.success(t("team.invite.created"));
      router.refresh();
    });
  }

  function updateRole(member: TeamMemberItem, nextRole: WorkspaceRole) {
    startTransition(async () => {
      const result = await changeMemberRole({ userId: member.userId, role: nextRole });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t("team.roleChanged"));
      router.refresh();
    });
  }

  async function remove(member: TeamMemberItem) {
    const result = await removeTeamMember({ userId: member.userId });
    if (!result.ok) {
      toast.error(result.error.message);
      throw new Error(result.error.code);
    }
    toast.success(t("team.removed"));
    router.refresh();
  }

  const columns: Array<DataTableColumn<TeamMemberItem>> = [
    {
      key: "member",
      header: t("team.columns.member"),
      cell: (member) => (
        <div className="flex items-center gap-2.5">
          <Avatar className="size-8">
            {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt="" /> : null}
            <AvatarFallback>{initials(member.displayName ?? member.email ?? "?")}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate font-medium">
              {member.displayName ?? t("team.noName")}
              {member.userId === currentUserId ? (
                <Badge variant="outline" className="font-normal">
                  {t("team.you")}
                </Badge>
              ) : null}
            </p>
            <p className="truncate text-xs text-muted-foreground">{member.email ?? "—"}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: t("team.columns.role"),
      cell: (member) => {
        if (member.isOwner) {
          return (
            <Badge variant="outline" className="font-normal">
              {t("team.ownerBadge")}
            </Badge>
          );
        }
        if (!canManage) return <span>{tc(`roles.${member.role}`)}</span>;
        // The owner role is offered only by the owner, but it must stay listed
        // when a member already holds it or the select would show nothing.
        const options: WorkspaceRole[] =
          canGrantOwner || member.role === "owner" ? [...ASSIGNABLE_ROLES, "owner"] : ASSIGNABLE_ROLES;
        return (
          <Select
            value={member.role}
            disabled={pending}
            onValueChange={(value) => {
              if (typeof value === "string" && value !== member.role) updateRole(member, value as WorkspaceRole);
            }}
          >
            <SelectTrigger size="sm" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {tc(`roles.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
    },
    {
      key: "joined",
      header: t("team.columns.joined"),
      cell: (member) => <span className="text-muted-foreground tabular-nums">{date(member.joinedAt)}</span>,
    },
    {
      key: "actions",
      header: t("team.columns.actions"),
      align: "end",
      cell: (member) =>
        canManage && !member.isOwner && member.userId !== currentUserId ? (
          <ConfirmDialog
            title={t("team.removeTitle")}
            description={t("team.removeDescription", { name: member.displayName ?? member.email ?? "" })}
            confirmLabel={t("team.removeButton")}
            destructive
            onConfirm={() => remove(member)}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={t("team.removeButton")}>
                <UserMinus />
              </Button>
            }
          />
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("team.invite.title")}</CardTitle>
            <CardDescription>{t("team.invite.description")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <InlineAlert tone="attention" title={t("team.invite.noEmailTitle")} icon={<Mail className="size-4 text-amber-600 dark:text-amber-400" />}>
              {t("team.invite.noEmailBody")}
            </InlineAlert>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field className="sm:flex-1">
                <FieldLabel htmlFor="invite-email">{t("team.invite.email")}</FieldLabel>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  placeholder={t("team.invite.emailPlaceholder")}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={inviteError !== null || undefined}
                />
              </Field>
              <Field className="sm:w-44">
                <FieldLabel htmlFor="invite-role">{t("team.invite.role")}</FieldLabel>
                <Select
                  value={role}
                  onValueChange={(value) => {
                    if (value === "admin" || value === "member") setRole(value);
                  }}
                >
                  <SelectTrigger id="invite-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {tc(`roles.${option}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Button onClick={invite} disabled={pending}>
                {pending ? <Spinner /> : <UserPlus />}
                {t("team.invite.submit")}
              </Button>
            </div>
            {inviteError ? <FieldError>{inviteError}</FieldError> : null}

            {invitation ? (
              <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Link2 className="size-4" />
                  {t("team.invite.linkTitle")}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1 font-mono text-xs">{invitation.inviteUrl}</code>
                  <CopyButton value={invitation.inviteUrl} withLabel variant="outline" />
                </div>
                <p className="text-xs text-muted-foreground">{t("team.invite.linkHint")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("team.invite.forEmail", { email: invitation.email })} · {t("team.invite.expires", { date: date(invitation.expiresAt) })}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("team.title")}</CardTitle>
          <CardDescription>{t("team.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            rows={members}
            rowKey={(member) => member.userId}
            emptyState={<p className="p-6 text-center text-sm text-muted-foreground">{t("team.empty")}</p>}
          />
          {canManage ? <p className="mt-2 text-xs text-muted-foreground">{t("team.ownerRoleLocked")}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?";
}
