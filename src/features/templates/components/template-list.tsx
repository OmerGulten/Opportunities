"use client";

import { cn } from "cn";
import { Copy, FileText, Lock, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog, EmptyState, Section } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { deleteTemplateAction, duplicateTemplateAction } from "@/features/templates/actions";
import { useFormatters, useT } from "@/lib/i18n/client";
import type { Locale, MessageChannel } from "@/types/common";

export type TemplateScope = "system" | "workspace" | "personal";

export interface TemplateCardData {
  id: string;
  name: string;
  scope: TemplateScope;
  channel: MessageChannel;
  /** Already localized, or null when the template is not tied to a service. */
  serviceName: string | null;
  categoryName: string | null;
  locale: Locale;
  tone: string;
  subject: string | null;
  body: string;
  variables: string[];
  usageCount: number;
  active: boolean;
  updatedAt: string;
}

export interface TemplateListProps {
  templates: TemplateCardData[];
  /** True when a filter is active, so "nothing here" reads differently. */
  filtered: boolean;
}

const SCOPE_ORDER: readonly TemplateScope[] = ["workspace", "personal", "system"] as const;

/** Templates grouped by scope, with the actions each scope actually allows. */
export function TemplateList({ templates, filtered }: TemplateListProps) {
  const t = useT("templates");
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function duplicate(template: TemplateCardData) {
    setPendingId(template.id);
    const result = await duplicateTemplateAction(template.id, template.scope === "personal" ? "personal" : "workspace");
    setPendingId(null);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(t("toast.duplicated"));
    router.push(`/templates/${result.data.id}`);
  }

  async function remove(template: TemplateCardData) {
    const result = await deleteTemplateAction(template.id);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(t("toast.deleted"));
    startTransition(() => router.refresh());
  }

  if (templates.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="size-5" />}
        title={filtered ? t("noResults.title") : t("empty.title")}
        description={filtered ? t("noResults.description") : t("empty.description")}
        action={
          filtered ? null : (
            <Button render={<Link href="/templates/new" />}>{t("empty.action")}</Button>
          )
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {SCOPE_ORDER.map((scope) => {
        const group = templates.filter((template) => template.scope === scope);
        if (group.length === 0) return null;
        return (
          <Section key={scope} title={t(`scope.${scope}`)} description={t(`scope.${scope}Description`)}>
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {group.map((template) => (
                <li key={template.id}>
                  <TemplateCard
                    template={template}
                    pending={pendingId === template.id}
                    onDuplicate={() => duplicate(template)}
                    onDelete={() => remove(template)}
                  />
                </li>
              ))}
            </ul>
          </Section>
        );
      })}
    </div>
  );
}

function TemplateCard({
  template,
  pending,
  onDuplicate,
  onDelete,
}: {
  template: TemplateCardData;
  pending: boolean;
  onDuplicate: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}) {
  const t = useT("templates");
  const tc = useT("common");
  const { date } = useFormatters();
  const readOnly = template.scope === "system";

  return (
    <article className="flex h-full flex-col gap-3 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
      <header className="flex items-start justify-between gap-2">
        <h3 className="font-heading min-w-0 text-base leading-snug font-medium">{template.name}</h3>
        {readOnly ? (
          <Badge variant="outline" className="shrink-0 gap-1 text-muted-foreground">
            <Lock className="size-3" />
            {t("readOnly")}
          </Badge>
        ) : null}
      </header>

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline">{tc(`channel.${template.channel}`)}</Badge>
        <Badge variant="outline" className="font-normal">
          {template.serviceName ?? t("card.noService")}
        </Badge>
        <Badge variant="outline" className="font-normal text-muted-foreground uppercase">
          {template.locale}
        </Badge>
        <Badge variant="outline" className="font-normal text-muted-foreground">
          {tc(`tone.${template.tone}`)}
        </Badge>
        {template.active ? null : (
          <Badge variant="outline" className="font-normal text-muted-foreground">
            {t("inactive")}
          </Badge>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-1">
        {template.subject ? <p className="truncate font-medium">{template.subject}</p> : null}
        <p className={cn("line-clamp-4 text-muted-foreground", !template.subject && "mt-0")}>{template.body}</p>
      </div>

      <dl className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <dd>{t("card.usage", { count: template.usageCount })}</dd>
        <dd>{t("card.variables", { count: template.variables.length })}</dd>
        <dd>{t("card.updated", { date: date(template.updatedAt) })}</dd>
      </dl>

      <footer className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {readOnly ? (
          <Button variant="outline" size="sm" onClick={onDuplicate} disabled={pending}>
            {pending ? <Spinner /> : <Copy />}
            {t("actions.duplicateToEdit")}
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" render={<Link href={`/templates/${template.id}`} />}>
              <Pencil />
              {t("actions.edit")}
            </Button>
            <Button variant="ghost" size="sm" onClick={onDuplicate} disabled={pending}>
              {pending ? <Spinner /> : <Copy />}
              {t("actions.duplicate")}
            </Button>
            <ConfirmDialog
              title={t("deleteConfirm.title")}
              description={t("deleteConfirm.description", { name: template.name })}
              confirmLabel={t("deleteConfirm.confirm")}
              destructive
              onConfirm={onDelete}
              trigger={
                <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label={t("actions.delete")}>
                  <Trash2 />
                </Button>
              }
            />
          </>
        )}
      </footer>
    </article>
  );
}
