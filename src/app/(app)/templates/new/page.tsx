import type { Metadata } from "next";

import { PageHeader } from "@/components/shared";
import { TemplateEditor, type TemplateEditorValues } from "@/features/templates/components/template-editor";
import { getRequestLocale, requireWorkspaceContext } from "@/lib/auth/context";
import { listCategories, listServices, localizedName } from "@/lib/db/reference";
import { getT } from "@/lib/i18n";
import { isMessageChannel } from "@/features/messages/components/options";
import type { Tone } from "@/types/common";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getRequestLocale(), "templates");
  return { title: t("editor.newTitle") };
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewTemplatePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireWorkspaceContext();
  const t = getT(ctx.locale, "templates");
  const params = await searchParams;

  const [services, categories] = await Promise.all([
    listServices(ctx.supabase),
    listCategories(ctx.supabase),
  ]);

  const channelParam = firstValue(params.channel);
  const serviceParam = firstValue(params.serviceId);

  const initial: TemplateEditorValues = {
    id: null,
    name: "",
    channel: isMessageChannel(channelParam) ? channelParam : "whatsapp",
    scope: "workspace",
    serviceId: serviceParam && services.some((service) => service.id === serviceParam) ? serviceParam : null,
    categoryId: null,
    tone: (ctx.workspace.default_tone as Tone) ?? "friendly_professional",
    locale: ctx.locale,
    subject: "",
    body: "",
    active: true,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("editor.newTitle")}
        description={t("editor.description")}
        breadcrumbs={[{ label: t("title"), href: "/templates" }, { label: t("editor.newTitle") }]}
      />
      <TemplateEditor
        initial={initial}
        services={services.map((service) => ({ id: service.id, name: localizedName(service, ctx.locale) }))}
        categories={categories.map((category) => ({ id: category.id, name: localizedName(category, ctx.locale) }))}
      />
    </div>
  );
}
