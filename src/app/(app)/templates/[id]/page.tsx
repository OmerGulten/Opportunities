import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText, Lock } from "lucide-react";

import { EmptyState, InlineAlert, PageHeader } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MESSAGE_VARIABLES, resolveTemplate } from "@/features/messages/variables";
import { DuplicateTemplateButton } from "@/features/templates/components/duplicate-template-button";
import { TemplateEditor, type TemplateEditorValues } from "@/features/templates/components/template-editor";
import { getTemplate } from "@/features/templates/service";
import { getRequestLocale, requireWorkspaceContext } from "@/lib/auth/context";
import { listCategories, listServices, localizedName } from "@/lib/db/reference";
import { getT } from "@/lib/i18n";
import type { Tone } from "@/types/common";

export const dynamic = "force-dynamic";

const SAMPLE_CONTEXT: Record<string, string> = Object.fromEntries(MESSAGE_VARIABLES.map((variable) => [variable.key, variable.example]));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getT(locale, "templates");
  try {
    const ctx = await requireWorkspaceContext();
    const template = await getTemplate(ctx, (await params).id);
    return { title: template?.name ?? t("editor.editTitle") };
  } catch {
    return { title: t("editor.editTitle") };
  }
}

export default async function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireWorkspaceContext();
  const t = getT(ctx.locale, "templates");
  const tc = getT(ctx.locale, "common");
  const { id } = await params;

  const template = await getTemplate(ctx, id);

  if (!template) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("editor.editTitle")} breadcrumbs={[{ label: t("title"), href: "/templates" }, { label: t("notFound.title") }]} />
        <EmptyState
          icon={<FileText className="size-5" />}
          title={t("notFound.title")}
          description={t("notFound.description")}
          action={
            <Button variant="outline" render={<Link href="/templates" />}>
              <ArrowLeft />
              {t("actions.back")}
            </Button>
          }
        />
      </div>
    );
  }

  const [services, categories] = await Promise.all([listServices(ctx.supabase), listCategories(ctx.supabase)]);
  const breadcrumbs = [{ label: t("title"), href: "/templates" }, { label: template.name }];
  const serviceNames = new Map(services.map((service) => [service.id, localizedName(service, ctx.locale)]));
  const serviceLabel = (template.service_id ? serviceNames.get(template.service_id) : null) ?? t("card.noService");

  // Seeded templates are shared platform content: show them, never edit them.
  if (template.scope === "system") {
    const preview = resolveTemplate(template.body, SAMPLE_CONTEXT);
    const subjectPreview = template.subject ? resolveTemplate(template.subject, SAMPLE_CONTEXT) : null;

    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title={template.name}
          description={t("scope.systemDescription")}
          breadcrumbs={breadcrumbs}
          actions={<DuplicateTemplateButton templateId={template.id} />}
        />

        <InlineAlert tone="neutral" title={t("readOnly")} icon={<Lock className="size-4 text-muted-foreground" />}>
          {t("readOnlyHint")}
        </InlineAlert>

        <section className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">{tc(`channel.${template.channel}`)}</Badge>
            <Badge variant="outline" className="font-normal text-muted-foreground">
              {tc(`tone.${template.tone}`)}
            </Badge>
            <Badge variant="outline" className="font-normal text-muted-foreground uppercase">
              {template.locale}
            </Badge>
            <Badge variant="outline" className="font-normal">
              {serviceLabel}
            </Badge>
          </div>

          {template.subject ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t("editor.subject")}</p>
              <p className="font-medium">{template.subject}</p>
            </div>
          ) : null}

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t("editor.body")}</p>
            <pre className="overflow-x-auto rounded-lg bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap">{template.body}</pre>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <header className="space-y-1">
            <h2 className="font-heading text-base leading-snug font-medium">{t("editor.preview.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("editor.preview.description")}</p>
          </header>
          {subjectPreview ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t("editor.preview.subject")}</p>
              <p className="text-sm font-medium">{subjectPreview.text}</p>
            </div>
          ) : null}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t("editor.preview.body")}</p>
            <p className="rounded-lg bg-muted/40 p-3 text-sm whitespace-pre-wrap">{preview.text}</p>
          </div>
          {preview.missing.length > 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">{t("editor.preview.missing", { names: preview.missing.join(", ") })}</p>
          ) : null}
        </section>
      </div>
    );
  }

  const initial: TemplateEditorValues = {
    id: template.id,
    name: template.name,
    channel: template.channel,
    scope: template.scope === "personal" ? "personal" : "workspace",
    serviceId: template.service_id,
    categoryId: template.category_id,
    tone: (template.tone as Tone) ?? "friendly_professional",
    locale: template.locale,
    subject: template.subject ?? "",
    body: template.body,
    active: template.active,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("editor.editTitle")}
        description={t("editor.description")}
        breadcrumbs={breadcrumbs}
        actions={<DuplicateTemplateButton templateId={template.id} scope={initial.scope} label={t("actions.duplicate")} />}
      />
      <TemplateEditor
        initial={initial}
        services={services.map((service) => ({ id: service.id, name: localizedName(service, ctx.locale) }))}
        categories={categories.map((category) => ({ id: category.id, name: localizedName(category, ctx.locale) }))}
      />
    </div>
  );
}
