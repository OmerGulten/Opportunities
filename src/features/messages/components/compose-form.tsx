"use client";

import { cn } from "cn";
import { AtSign, ExternalLink, MessageCircle, Save, Send, Sparkles, TriangleAlert } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { CopyButton, DemoBadge, InlineAlert } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/client";
import { MESSAGE_CHANNELS, MESSAGE_LENGTHS } from "@/features/messages/components/options";
import { TONES, type MessageChannel, type MessageLength, type Tone } from "@/types/common";

import { creditShortfall, patchJson, postJson, type ApiFailure } from "./api";
import { buildChannelLink, missingContactKey, type BusinessContactLinks } from "./channel-links";

const NONE = "__none__";

const channelIcon: Record<MessageChannel, ReactNode> = {
  whatsapp: <MessageCircle className="size-4" aria-hidden />,
  email: <AtSign className="size-4" aria-hidden />,
  // lucide-react v1 dropped brand marks; a neutral send glyph stands in for the
  // Instagram DM channel (shared/service.tsx makes the same substitution).
  instagram_dm: <Send className="size-4" aria-hidden />,
};

const openChannelKey: Record<MessageChannel, string> = {
  whatsapp: "actions.openWhatsapp",
  email: "actions.openEmail",
  instagram_dm: "actions.openInstagram",
};

export interface ComposeServiceOption {
  id: string;
  /** Already localized. */
  name: string;
}

export interface ComposeTemplateOption {
  id: string;
  name: string;
  channel: MessageChannel;
  serviceId: string | null;
  scope: "system" | "workspace" | "personal";
}

interface GenerateResponse {
  message: { subject: string | null; body: string };
  generationId: string;
  provider: string;
  model: string;
  isDemo: boolean;
  creditsConsumed: number;
  warnings: Array<{ type: string; detail: string }>;
  attempts: number;
}

interface SavedMessage {
  id: string;
}

export interface ComposeFormProps {
  businessId: string;
  contacts: BusinessContactLinks;
  services: ComposeServiceOption[];
  templates: ComposeTemplateOption[];
  /** Enabled offering name per service id; drives the "will be attached" hint. */
  offeringNames: Record<string, string>;
  defaultTone: Tone;
  defaultServiceId: string | null;
  reportLinkAvailable: boolean;
  /** Credits a successful generation consumes, from the pricing table. */
  aiMessageCost: number;
}

/**
 * The compose experience.
 *
 * Generation, saving and status tracking all go through the API routes so the
 * rate limit, credit accounting and fact guard stay on the server. The app
 * never transmits the message: the channel button only opens the user's own
 * client with the text pre-filled.
 */
export function ComposeForm({
  businessId,
  contacts,
  services,
  templates,
  offeringNames,
  defaultTone,
  defaultServiceId,
  reportLinkAvailable,
  aiMessageCost,
}: ComposeFormProps) {
  const t = useT("messages");
  const tc = useT("common");
  const te = useT("errors");

  const [channel, setChannel] = useState<MessageChannel>("whatsapp");
  const [serviceId, setServiceId] = useState<string | null>(defaultServiceId);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [tone, setTone] = useState<Tone>(defaultTone);
  const [length, setLength] = useState<MessageLength>("medium");
  const [instruction, setInstruction] = useState("");
  const [includeReportLink, setIncludeReportLink] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saved, setSaved] = useState<{ id: string; subject: string; body: string } | null>(null);
  const inFlightSave = useRef<Promise<string | null> | null>(null);

  // A template only applies to its own channel, and the picker must not keep a
  // stale selection when the channel changes: derive it instead of syncing.
  const channelTemplates = templates.filter((template) => template.channel === channel);
  const effectiveTemplateId = templateId && channelTemplates.some((template) => template.id === templateId) ? templateId : null;

  const generated = result?.message ?? null;
  const edited = generated !== null && (body !== generated.body || subject !== (generated.subject ?? ""));
  const isSaved = saved !== null && saved.body === body && saved.subject === subject;
  const channelLink = generated ? buildChannelLink({ channel, contacts, subject: subject || null, body }) : null;

  // Base UI resolves the trigger's label from this map; without it the raw
  // value (a uuid, an enum key) would be shown instead of the label.
  const serviceItems: Record<string, string> = { [NONE]: t("form.serviceNone"), ...Object.fromEntries(services.map((service) => [service.id, service.name])) };
  const templateItems: Record<string, string> = {
    [NONE]: t("form.templateNone"),
    ...Object.fromEntries(channelTemplates.map((template) => [template.id, template.name])),
  };
  const toneItems: Record<string, string> = Object.fromEntries(TONES.map((option) => [option, tc(`tone.${option}`)]));
  const lengthItems: Record<string, string> = Object.fromEntries(MESSAGE_LENGTHS.map((option) => [option, tc(`length.${option}`)]));

  function describeFailure(error: ApiFailure): string {
    const shortfall = creditShortfall(error);
    if (shortfall) return te("insufficient_credits", shortfall);
    const message = te(error.code);
    return message === error.code ? te("generic") : message;
  }

  async function handleGenerate() {
    setGenerating(true);
    setFailure(null);
    const response = await postJson<GenerateResponse>("/api/messages/generate", {
      businessId,
      channel,
      serviceId,
      templateId: effectiveTemplateId,
      tone,
      length,
      includeReportLink,
      instruction: instruction.trim() ? instruction.trim() : null,
    });
    setGenerating(false);

    if (!response.ok) {
      setFailure(response.error);
      toast.error(describeFailure(response.error));
      return;
    }

    setResult(response.data);
    setSubject(response.data.message.subject ?? "");
    setBody(response.data.message.body);
    setSaved(null);
    toast.success(t("toast.generated"));
  }

  /**
   * Persists the current text once, so a status update has something to point
   * at. Copy and "open channel" can both trigger it, so an in-flight save is
   * shared instead of inserting the draft twice.
   */
  function ensureSaved(): Promise<string | null> {
    if (isSaved && saved) return Promise.resolve(saved.id);
    if (!result) return Promise.resolve(null);
    if (inFlightSave.current) return inFlightSave.current;

    const promise = saveDraft().finally(() => {
      inFlightSave.current = null;
    });
    inFlightSave.current = promise;
    return promise;
  }

  async function saveDraft(): Promise<string | null> {
    if (!result) return null;

    const response = await postJson<SavedMessage>("/api/messages", {
      businessId,
      channel,
      body,
      subject: channel === "email" && subject.trim() ? subject.trim() : null,
      serviceId,
      templateId: effectiveTemplateId,
      generationId: result.generationId,
      tone,
      edited,
    });

    if (!response.ok) {
      setFailure(response.error);
      toast.error(describeFailure(response.error));
      return null;
    }
    setSaved({ id: response.data.id, subject, body });
    return response.data.id;
  }

  async function markStatus(messageId: string, status: "copied" | "channel_opened") {
    const response = await patchJson<SavedMessage>("/api/messages/status", { messageId, status });
    if (!response.ok) {
      setFailure(response.error);
      toast.error(describeFailure(response.error));
    }
  }

  async function handleSave() {
    setBusy(true);
    setFailure(null);
    const id = await ensureSaved();
    setBusy(false);
    if (id) toast.success(t("toast.saved"));
  }

  /**
   * Runs after CopyButton's own click handler has put the text on the
   * clipboard; it records that the draft left the app.
   */
  function handleCopyTracked() {
    if (!result) return;
    void (async () => {
      const id = await ensureSaved();
      if (id) await markStatus(id, "copied");
    })();
  }

  function handleOpenChannel() {
    if (!channelLink) return;
    // Opened synchronously inside the click so the browser does not treat it as
    // a pop-up; the bookkeeping happens afterwards.
    window.open(channelLink, "_blank", "noopener,noreferrer");
    void (async () => {
      const id = await ensureSaved();
      if (id) {
        await markStatus(id, "channel_opened");
        toast.success(t("toast.channelOpened"));
      }
    })();
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="font-heading text-base leading-snug font-medium">{t("form.title")}</h2>

        <Field>
          <FieldTitle>{t("form.channel")}</FieldTitle>
          <div role="radiogroup" aria-label={t("form.channel")} className="flex flex-wrap gap-2">
            {MESSAGE_CHANNELS.map((option) => {
              const active = option === channel;
              return (
                <Button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  variant={active ? "secondary" : "outline"}
                  className={cn(active && "border-primary/40 ring-1 ring-primary/30")}
                  onClick={() => setChannel(option)}
                >
                  {channelIcon[option]}
                  {tc(`channel.${option}`)}
                </Button>
              );
            })}
          </div>
          <FieldDescription>{t("form.channelHint")}</FieldDescription>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="compose-service">{t("form.service")}</FieldLabel>
            <Select
              items={serviceItems}
              value={serviceId ?? NONE}
              onValueChange={(value) => {
                if (typeof value === "string") setServiceId(value === NONE ? null : value);
              }}
            >
              <SelectTrigger id="compose-service" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("form.serviceNone")}</SelectItem>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              {serviceId && offeringNames[serviceId] ? t("form.offeringAttached", { name: offeringNames[serviceId] }) : t("form.serviceHint")}
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="compose-template">{t("form.template")}</FieldLabel>
            <Select
              items={templateItems}
              value={effectiveTemplateId ?? NONE}
              onValueChange={(value) => {
                if (typeof value === "string") setTemplateId(value === NONE ? null : value);
              }}
            >
              <SelectTrigger id="compose-template" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("form.templateNone")}</SelectItem>
                {channelTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>{t("form.templateHint")}</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="compose-tone">{t("form.tone")}</FieldLabel>
            <Select
              items={toneItems}
              value={tone}
              onValueChange={(value) => {
                if (typeof value === "string") setTone(value as Tone);
              }}
            >
              <SelectTrigger id="compose-tone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {tc(`tone.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="compose-length">{t("form.length")}</FieldLabel>
            <Select
              items={lengthItems}
              value={length}
              onValueChange={(value) => {
                if (typeof value === "string") setLength(value as MessageLength);
              }}
            >
              <SelectTrigger id="compose-length" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESSAGE_LENGTHS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {tc(`length.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="compose-instruction">{t("form.instruction")}</FieldLabel>
          <Textarea
            id="compose-instruction"
            value={instruction}
            maxLength={500}
            rows={2}
            placeholder={t("form.instructionPlaceholder")}
            onChange={(event) => setInstruction(event.target.value)}
          />
          <FieldDescription>{t("form.instructionHint")}</FieldDescription>
        </Field>

        <Field orientation="horizontal">
          <Switch
            id="compose-report-link"
            checked={includeReportLink}
            onCheckedChange={(checked) => setIncludeReportLink(checked === true)}
          />
          <div className="min-w-0 space-y-0.5">
            <FieldLabel htmlFor="compose-report-link">{t("form.includeReportLink")}</FieldLabel>
            <FieldDescription>{reportLinkAvailable ? t("form.includeReportLinkHint") : t("form.includeReportLinkUnavailable")}</FieldDescription>
          </div>
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">{aiMessageCost > 0 ? t("form.cost", { count: aiMessageCost }) : t("form.costFree")}</p>
          <Button type="button" onClick={handleGenerate} disabled={generating}>
            {generating ? <Spinner /> : <Sparkles />}
            {generating ? t("form.generating") : result ? t("form.regenerate") : t("form.generate")}
          </Button>
        </div>
      </section>

      {failure ? (
        <InlineAlert tone="negative" title={tc("states.error")}>
          {describeFailure(failure)}
        </InlineAlert>
      ) : null}

      {result ? (
        <section className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-base leading-snug font-medium">{t("draft.title")}</h2>
            <div className="flex flex-wrap items-center gap-2">
              {result.isDemo ? <DemoBadge /> : null}
              {edited ? <Badge variant="outline">{t("draft.edited")}</Badge> : null}
              {isSaved ? <Badge variant="outline">{t("actions.saved")}</Badge> : null}
            </div>
          </header>

          {result.warnings.length > 0 ? (
            <InlineAlert tone="attention" title={t("warnings.title")} icon={<TriangleAlert className="size-4 text-amber-600 dark:text-amber-400" />}>
              <p>{t("warnings.description")}</p>
              <ul className="mt-2 space-y-1.5">
                {result.warnings.map((warning, index) => (
                  <li key={`${warning.type}-${warning.detail}-${index}`} className="flex flex-wrap items-baseline gap-2">
                    <Badge variant="outline" className="border-amber-600/30 text-amber-700 dark:border-amber-400/30 dark:text-amber-300">
                      {translateWarningType(t, warning.type)}
                    </Badge>
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all">{warning.detail}</code>
                  </li>
                ))}
              </ul>
            </InlineAlert>
          ) : null}

          {channel === "email" ? (
            <Field>
              <FieldLabel htmlFor="draft-subject">{t("draft.subject")}</FieldLabel>
              <Input
                id="draft-subject"
                value={subject}
                maxLength={200}
                placeholder={t("draft.subjectPlaceholder")}
                onChange={(event) => setSubject(event.target.value)}
              />
            </Field>
          ) : null}

          <Field>
            <FieldLabel htmlFor="draft-body">{t("draft.body")}</FieldLabel>
            <Textarea
              id="draft-body"
              value={body}
              rows={12}
              maxLength={5000}
              placeholder={t("draft.bodyPlaceholder")}
              className="min-h-64 font-normal"
              onChange={(event) => setBody(event.target.value)}
            />
            <FieldDescription>{t("draft.charCount", { count: body.length })}</FieldDescription>
          </Field>

          <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <MetaItem label={t("draft.meta.provider")} value={result.provider} />
            <MetaItem label={t("draft.meta.model")} value={result.model} />
            <span>{result.creditsConsumed > 0 ? t("draft.meta.credits", { count: result.creditsConsumed }) : t("draft.meta.creditsNone")}</span>
            {result.attempts > 1 ? <span>{t("draft.meta.attempts", { count: result.attempts })}</span> : null}
          </dl>

          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* The copy itself is CopyButton's job; this wrapper records that it happened. */}
              <span className="contents" onClickCapture={handleCopyTracked} role="presentation">
                <CopyButton value={composeClipboardText(channel, subject, body)} withLabel variant="outline" label={t("actions.copy")} />
              </span>
              <Button type="button" variant="outline" onClick={handleSave} disabled={busy || isSaved}>
                {busy ? <Spinner /> : <Save />}
                {busy ? t("actions.saving") : isSaved ? t("actions.saved") : t("actions.save")}
              </Button>
              <Button type="button" onClick={handleOpenChannel} disabled={!channelLink}>
                <ExternalLink />
                {t(openChannelKey[channel])}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{channelLink ? t("actions.opensNewTab") : t(missingContactKey(channel))}</p>
          </div>
        </section>
      ) : (
        <section className="flex flex-col items-start gap-1 rounded-xl border border-dashed border-border p-6">
          <p className="text-sm font-medium">{t("draft.empty")}</p>
          <p className="text-sm text-muted-foreground">{t("draft.emptyHint")}</p>
        </section>
      )}
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span>{label}:</span>
      <span className="font-mono text-foreground/80">{value}</span>
    </span>
  );
}

/** Known guard types get a sentence; an unknown one is shown as-is, not hidden. */
function translateWarningType(t: (key: string) => string, type: string): string {
  const label = t(`warnings.type.${type}`);
  return label === `warnings.type.${type}` ? type : label;
}

function composeClipboardText(channel: MessageChannel, subject: string, body: string): string {
  if (channel === "email" && subject.trim()) return `${subject.trim()}\n\n${body}`;
  return body;
}
