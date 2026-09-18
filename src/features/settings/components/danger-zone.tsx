"use client";

import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { deleteCurrentAccount, deleteCurrentWorkspace } from "@/features/settings/actions";
import { useT } from "@/lib/i18n/client";

/**
 * Irreversible flows.
 *
 * Both require the exact confirmation the server schema demands — the account
 * word and the workspace name — and the check runs on the server as well, so a
 * mistyped confirmation can never delete anything.
 */

function DangerCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="border-destructive/30 ring-destructive/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <TriangleAlert className="size-4" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function DeleteAccountCard() {
  const t = useT("settings");
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const word = t("account.confirmWord");

  async function confirm() {
    if (value.trim() !== word) {
      setError(t("account.mismatch"));
      // Rejecting keeps the dialog open so the message stays next to the input.
      throw new Error("confirmation_mismatch");
    }
    setError(null);
    const result = await deleteCurrentAccount({ confirm: value.trim() });
    if (result && !result.ok) {
      // Deleting an auth user needs the service-role key; say so rather than
      // showing the generic "conflict" sentence.
      const message = result.error.code === "conflict" ? t("account.notConfigured") : result.error.message;
      setError(message);
      toast.error(message);
      throw new Error(result.error.code);
    }
  }

  return (
    <DangerCard title={t("account.title")} description={t("account.description")}>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setValue("");
            setError(null);
          }
        }}
        title={t("account.dialogTitle")}
        description={t("account.dialogDescription", { word })}
        confirmLabel={t("account.button")}
        destructive
        onConfirm={confirm}
        trigger={
          <Button variant="destructive">{t("account.button")}</Button>
        }
      >
        <Field>
          <FieldLabel htmlFor="delete-account-confirm">{t("account.confirmLabel")}</FieldLabel>
          <Input
            id="delete-account-confirm"
            value={value}
            autoComplete="off"
            placeholder={word}
            onChange={(event) => setValue(event.target.value)}
            aria-invalid={error !== null || undefined}
          />
          {error ? <FieldError>{error}</FieldError> : null}
        </Field>
      </ConfirmDialog>
    </DangerCard>
  );
}

export interface DeleteWorkspaceCardProps {
  workspaceName: string;
  /** Only the owner may delete; others see the rule instead of a dead button. */
  isOwner: boolean;
}

export function DeleteWorkspaceCard({ workspaceName, isOwner }: DeleteWorkspaceCardProps) {
  const t = useT("settings");
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (value.trim() !== workspaceName.trim()) {
      setError(t("workspace.danger.mismatch"));
      throw new Error("confirmation_mismatch");
    }
    setError(null);
    const result = await deleteCurrentWorkspace({ confirmName: value.trim() });
    if (result && !result.ok) {
      setError(result.error.message);
      toast.error(result.error.message);
      throw new Error(result.error.code);
    }
  }

  return (
    <DangerCard title={t("workspace.danger.title")} description={t("workspace.danger.description")}>
      {isOwner ? (
        <ConfirmDialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) {
              setValue("");
              setError(null);
            }
          }}
          title={t("workspace.danger.dialogTitle", { name: workspaceName })}
          description={t("workspace.danger.dialogDescription")}
          confirmLabel={t("workspace.danger.button")}
          destructive
          onConfirm={confirm}
          trigger={
            <Button variant="destructive">{t("workspace.danger.button")}</Button>
          }
        >
          <Field>
            <FieldLabel htmlFor="delete-workspace-confirm">{t("workspace.danger.confirmLabel")}</FieldLabel>
            <Input
              id="delete-workspace-confirm"
              value={value}
              autoComplete="off"
              placeholder={workspaceName}
              onChange={(event) => setValue(event.target.value)}
              aria-invalid={error !== null || undefined}
            />
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>
        </ConfirmDialog>
      ) : (
        <p className="text-sm text-muted-foreground">{t("common.ownerOnly")}</p>
      )}
    </DangerCard>
  );
}
