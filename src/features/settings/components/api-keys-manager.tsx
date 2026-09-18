"use client";

import { KeyRound, ShieldAlert, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog, CopyButton, DataTable, InlineAlert, type DataTableColumn } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { createWorkspaceApiKey, revokeWorkspaceApiKey } from "@/features/settings/actions";
import { useFormatters, useT } from "@/lib/i18n/client";

export interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface ApiKeysManagerProps {
  keys: ApiKeyItem[];
  canManage: boolean;
  /** The `api_keys` feature flag; when off the list stays readable. */
  enabled: boolean;
}

/**
 * API key management.
 *
 * The plaintext key exists only in the response that created it — the database
 * stores a hash — so the dialog says plainly that it will not be shown again.
 */
export function ApiKeysManager({ keys, canManage, enabled }: ApiKeysManagerProps) {
  const t = useT("settings");
  const router = useRouter();
  const { dateTime } = useFormatters();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ name: string; key: string } | null>(null);

  function create() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError(t("errors.nameRequired"));
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await createWorkspaceApiKey({ name: trimmed });
      if (!result.ok) {
        setError(result.error.message);
        toast.error(result.error.message);
        return;
      }
      setSecret({ name: result.data.name, key: result.data.key });
      setName("");
      toast.success(t("apiKeys.create.created"));
      router.refresh();
    });
  }

  async function revoke(item: ApiKeyItem) {
    const result = await revokeWorkspaceApiKey({ id: item.id });
    if (!result.ok) {
      toast.error(result.error.message);
      throw new Error(result.error.code);
    }
    toast.success(t("apiKeys.revoked"));
    router.refresh();
  }

  const columns: Array<DataTableColumn<ApiKeyItem>> = [
    {
      key: "name",
      header: t("apiKeys.columns.name"),
      cell: (item) => <span className="font-medium">{item.name}</span>,
    },
    {
      key: "prefix",
      header: t("apiKeys.columns.prefix"),
      cell: (item) => <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{item.prefix}</code>,
    },
    {
      key: "created",
      header: t("apiKeys.columns.created"),
      cell: (item) => <span className="text-muted-foreground tabular-nums">{dateTime(item.createdAt)}</span>,
    },
    {
      key: "lastUsed",
      header: t("apiKeys.columns.lastUsed"),
      cell: (item) => (
        <span className="text-muted-foreground tabular-nums">{item.lastUsedAt ? dateTime(item.lastUsedAt) : t("apiKeys.neverUsed")}</span>
      ),
    },
    {
      key: "status",
      header: t("apiKeys.columns.status"),
      cell: (item) =>
        item.revokedAt ? (
          <Badge variant="outline" className="font-normal text-muted-foreground">
            {t("apiKeys.status.revoked")}
          </Badge>
        ) : (
          <Badge variant="outline" className="border-emerald-600/25 bg-emerald-500/12 font-normal text-emerald-700 dark:border-emerald-400/25 dark:text-emerald-300">
            {t("apiKeys.status.active")}
          </Badge>
        ),
    },
    {
      key: "actions",
      header: t("apiKeys.columns.actions"),
      align: "end",
      cell: (item) =>
        canManage && !item.revokedAt ? (
          <ConfirmDialog
            title={t("apiKeys.revokeTitle")}
            description={t("apiKeys.revokeDescription", { name: item.name })}
            confirmLabel={t("apiKeys.revoke")}
            destructive
            onConfirm={() => revoke(item)}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={t("apiKeys.revoke")}>
                <Trash2 />
              </Button>
            }
          />
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {!enabled ? <InlineAlert tone="attention">{t("apiKeys.disabled")}</InlineAlert> : null}

      {canManage && enabled ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("apiKeys.create.title")}</CardTitle>
            <CardDescription>{t("apiKeys.description")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field className="sm:flex-1">
              <FieldLabel htmlFor="api-key-name">{t("apiKeys.create.name")}</FieldLabel>
              <Input
                id="api-key-name"
                value={name}
                maxLength={80}
                placeholder={t("apiKeys.create.namePlaceholder")}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={error !== null || undefined}
              />
              <FieldDescription>{t("apiKeys.scopesHint")}</FieldDescription>
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
            <Button onClick={create} disabled={pending}>
              {pending ? <Spinner /> : <KeyRound />}
              {t("apiKeys.create.submit")}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("apiKeys.title")}</CardTitle>
          <CardDescription>{t("apiKeys.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            rows={keys}
            rowKey={(item) => item.id}
            emptyState={<p className="p-6 text-center text-sm text-muted-foreground">{t("apiKeys.empty")}</p>}
          />
        </CardContent>
      </Card>

      <Dialog
        open={secret !== null}
        onOpenChange={(next) => {
          if (!next) setSecret(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("apiKeys.secret.title")}</DialogTitle>
            <DialogDescription>{secret?.name}</DialogDescription>
          </DialogHeader>
          <InlineAlert tone="attention" icon={<ShieldAlert className="size-4 text-amber-600 dark:text-amber-400" />}>
            {t("apiKeys.secret.warning")}
          </InlineAlert>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-2 font-mono text-xs" aria-label={t("apiKeys.secret.label")}>
              {secret?.key}
            </code>
            <CopyButton value={secret?.key ?? ""} withLabel variant="outline" />
          </div>
          <DialogFooter>
            <Button onClick={() => setSecret(null)}>{t("apiKeys.secret.done")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
