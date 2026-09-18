"use client";

import { cn } from "cn";
import { ArrowLeft, Braces, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { InlineAlert } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MESSAGE_CHANNELS } from "@/features/messages/components/options";
import { MESSAGE_VARIABLES, resolveTemplate, validateTemplateBody } from "@/features/messages/variables";
import { createTemplateAction, updateTemplateAction } from "@/features/templates/actions";
import { useT } from "@/lib/i18n/client";
import { LOCALES, TONES, type Locale, type MessageChannel, type Tone } from "@/types/common";

const NONE = "__none__";
const MAX_BODY = 6000;
const MAX_SUBJECT = 200;

/** Every known variable has a sample, so the preview shows a realistic result. */
const SAMPLE_CONTEXT: Record<string, string> = Object.fromEntries(MESSAGE_VARIABLES.map((variable) => [variable.key, variable.example]));

export interface TemplateReferenceOption {
  id: string;
  /** Already localized. */
  name: string;
}

export interface TemplateEditorValues {
  id: string | null;
  name: string;
  channel: MessageChannel;
  scope: "workspace" | "personal";
  serviceId: string | null;
  categoryId: string | null;
  tone: Tone;
  locale: Locale;
  subject: string;
  body: string;
  active: boolean;
}

export interface TemplateEditorProps {
  initial: TemplateEditorValues;
  services: TemplateReferenceOption[];
  categories: TemplateReferenceOption[];
}

/**
 * Template editor with a variable palette and a live preview.
 *
 * Variables resolve from verified facts only, so a name we cannot resolve is a
 * validation error rather than something that quietly renders as empty text.
 */
export function TemplateEditor({ initial, services, categories }: TemplateEditorProps) {
  const t = useT("templates");
  const tm = useT("messages");
  const tc = useT("common");
  const router = useRouter();

  const [name, setName] = useState(initial.name);
  const [channel, setChannel] = useState<MessageChannel>(initial.channel);
  const [scope, setScope] = useState<"workspace" | "personal">(initial.scope);
  const [serviceId, setServiceId] = useState<string | null>(initial.serviceId);
  const [categoryId, setCategoryId] = useState<string | null>(initial.categoryId);
  const [tone, setTone] = useState<Tone>(initial.tone);
  const [locale, setLocale] = useState<Locale>(initial.locale);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [active, setActive] = useState(initial.active);

  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [activeField, setActiveField] = useState<"subject" | "body">("body");

  const isEdit = initial.id !== null;

  const unknownVariables = [
    ...new Set([...validateTemplateBody(body).unknownVariables, ...validateTemplateBody(subject).unknownVariables]),
  ];
  const nameError = name.trim().length === 0 ? t("editor.errors.nameRequired") : null;
  const bodyError =
    body.trim().length === 0
      ? t("editor.errors.bodyRequired")
      : body.length > MAX_BODY
        ? t("editor.errors.bodyTooLong")
        : null;
  const subjectError = subject.length > MAX_SUBJECT ? t("editor.errors.subjectTooLong") : null;
  const variablesError = unknownVariables.length > 0 ? t("editor.variables.unknown", { names: unknownVariables.join(", ") }) : null;
  const invalid = Boolean(nameError || bodyError || subjectError || variablesError);

  const preview = resolveTemplate(body, SAMPLE_CONTEXT);
  const subjectPreview = subject.trim().length > 0 ? resolveTemplate(subject, SAMPLE_CONTEXT) : null;
  const usedVariables = [...new Set([...preview.used, ...(subjectPreview?.used ?? [])])];

  // Base UI resolves the trigger label from this map, not from the item nodes.
  const channelItems: Record<string, string> = Object.fromEntries(MESSAGE_CHANNELS.map((option) => [option, tc(`channel.${option}`)]));
  const serviceItems: Record<string, string> = { [NONE]: t("editor.serviceNone"), ...Object.fromEntries(services.map((service) => [service.id, service.name])) };
  const categoryItems: Record<string, string> = { [NONE]: t("editor.categoryNone"), ...Object.fromEntries(categories.map((category) => [category.id, category.name])) };
  const toneItems: Record<string, string> = Object.fromEntries(TONES.map((option) => [option, tc(`tone.${option}`)]));
  const localeItems: Record<string, string> = Object.fromEntries(LOCALES.map((option) => [option, option.toUpperCase()]));
  const scopeItems: Record<string, string> = { workspace: t("editor.scopeWorkspace"), personal: t("editor.scopePersonal") };

  /** Inserts a variable at the caret of whichever text field was last focused. */
  function insertVariable(key: string) {
    const token = `{{${key}}}`;
    const element = activeField === "subject" ? subjectRef.current : bodyRef.current;
    if (!element) return;

    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? start;
    const next = `${element.value.slice(0, start)}${token}${element.value.slice(end)}`;
    if (activeField === "subject") setSubject(next);
    else setBody(next);

    const caret = start + token.length;
    // The DOM value is replaced on the next paint; restore the caret after it.
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(caret, caret);
    });
  }

  async function handleSubmit() {
    setSubmitted(true);
    setServerError(null);
    if (invalid) return;

    const payload = {
      name: name.trim(),
      channel,
      serviceId,
      categoryId,
      tone,
      locale,
      subject: subject.trim() ? subject.trim() : null,
      body: body.trim(),
      active,
    };

    setSaving(true);
    const result = isEdit && initial.id ? await updateTemplateAction(initial.id, payload) : await createTemplateAction({ ...payload, scope });
    setSaving(false);

    if (!result.ok) {
      setServerError(result.error.message);
      toast.error(result.error.message);
      return;
    }

    toast.success(isEdit ? t("toast.updated") : t("toast.created"));
    router.push("/templates");
    router.refresh();
  }

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <Field>
            <FieldLabel htmlFor="template-name">{t("editor.name")}</FieldLabel>
            <Input
              id="template-name"
              value={name}
              maxLength={120}
              placeholder={t("editor.namePlaceholder")}
              aria-invalid={submitted && nameError ? true : undefined}
              onChange={(event) => setName(event.target.value)}
            />
            {submitted && nameError ? <FieldError>{nameError}</FieldError> : null}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="template-channel">{t("editor.channel")}</FieldLabel>
              <Select
                items={channelItems}
                value={channel}
                onValueChange={(value) => {
                  if (typeof value === "string") setChannel(value as MessageChannel);
                }}
              >
                <SelectTrigger id="template-channel" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESSAGE_CHANNELS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {tc(`channel.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="template-service">{t("editor.service")}</FieldLabel>
              <Select
                items={serviceItems}
                value={serviceId ?? NONE}
                onValueChange={(value) => {
                  if (typeof value === "string") setServiceId(value === NONE ? null : value);
                }}
              >
                <SelectTrigger id="template-service" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("editor.serviceNone")}</SelectItem>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="template-category">{t("editor.category")}</FieldLabel>
              <Select
                items={categoryItems}
                value={categoryId ?? NONE}
                onValueChange={(value) => {
                  if (typeof value === "string") setCategoryId(value === NONE ? null : value);
                }}
              >
                <SelectTrigger id="template-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("editor.categoryNone")}</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="template-tone">{t("editor.tone")}</FieldLabel>
              <Select
                items={toneItems}
                value={tone}
                onValueChange={(value) => {
                  if (typeof value === "string") setTone(value as Tone);
                }}
              >
                <SelectTrigger id="template-tone" className="w-full">
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
              <FieldLabel htmlFor="template-locale">{t("editor.locale")}</FieldLabel>
              <Select
                items={localeItems}
                value={locale}
                onValueChange={(value) => {
                  if (typeof value === "string") setLocale(value as Locale);
                }}
              >
                <SelectTrigger id="template-locale" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCALES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {isEdit ? (
              <Field>
                <FieldTitle>{t("editor.scope")}</FieldTitle>
                <div>
                  <Badge variant="outline">{t(`scope.${initial.scope}`)}</Badge>
                </div>
                <FieldDescription>{t("editor.scopeHint")}</FieldDescription>
              </Field>
            ) : (
              <Field>
                <FieldLabel htmlFor="template-scope">{t("editor.scope")}</FieldLabel>
                <Select
                  items={scopeItems}
                  value={scope}
                  onValueChange={(value) => {
                    if (value === "workspace" || value === "personal") setScope(value);
                  }}
                >
                  <SelectTrigger id="template-scope" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="workspace">{t("editor.scopeWorkspace")}</SelectItem>
                    <SelectItem value="personal">{t("editor.scopePersonal")}</SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>{t("editor.scopeHint")}</FieldDescription>
              </Field>
            )}
          </div>

          <Field orientation="horizontal">
            <Switch id="template-active" checked={active} onCheckedChange={(checked) => setActive(checked === true)} />
            <div className="min-w-0 space-y-0.5">
              <FieldLabel htmlFor="template-active">{t("editor.active")}</FieldLabel>
              <FieldDescription>{t("editor.activeHint")}</FieldDescription>
            </div>
          </Field>
        </section>

        <section className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <Field>
            <FieldLabel htmlFor="template-subject">{t("editor.subject")}</FieldLabel>
            <Input
              id="template-subject"
              ref={subjectRef}
              value={subject}
              maxLength={MAX_SUBJECT}
              placeholder={t("editor.subjectPlaceholder")}
              aria-invalid={submitted && subjectError ? true : undefined}
              onFocus={() => setActiveField("subject")}
              onChange={(event) => setSubject(event.target.value)}
            />
            <FieldDescription>{t("editor.subjectHint")}</FieldDescription>
            {submitted && subjectError ? <FieldError>{subjectError}</FieldError> : null}
          </Field>

          <Field>
            <FieldLabel htmlFor="template-body">{t("editor.body")}</FieldLabel>
            <Textarea
              id="template-body"
              ref={bodyRef}
              value={body}
              rows={14}
              maxLength={MAX_BODY}
              placeholder={t("editor.bodyPlaceholder")}
              className="min-h-72 font-mono text-sm"
              aria-invalid={submitted && bodyError ? true : undefined}
              onFocus={() => setActiveField("body")}
              onChange={(event) => setBody(event.target.value)}
            />
            {submitted && bodyError ? <FieldError>{bodyError}</FieldError> : null}
          </Field>

          {variablesError ? (
            <InlineAlert tone="negative" title={t("editor.variables.unknownTitle")}>
              {variablesError}
            </InlineAlert>
          ) : null}

          {serverError ? (
            <InlineAlert tone="negative" title={tc("states.error")}>
              {serverError}
            </InlineAlert>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <Button type="button" onClick={handleSubmit} disabled={saving || (submitted && invalid)}>
              {saving ? <Spinner /> : <Save />}
              {saving ? t("actions.saving") : isEdit ? t("actions.save") : t("actions.create")}
            </Button>
            <Button variant="ghost" render={<Link href="/templates" />}>
              <ArrowLeft />
              {t("actions.back")}
            </Button>
          </div>
        </section>
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <section className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <header className="space-y-1">
            <div className="flex items-center gap-2">
              <Braces className="size-4 text-primary" aria-hidden />
              <h2 className="font-heading text-base leading-snug font-medium">{t("editor.variables.title")}</h2>
            </div>
            <p className="text-xs text-muted-foreground">{t("editor.variables.description")}</p>
          </header>

          <ul className="flex flex-wrap gap-1.5">
            {MESSAGE_VARIABLES.map((variable) => {
              const used = usedVariables.includes(variable.key);
              return (
                <li key={variable.key}>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          className={cn("font-mono", used && "border-primary/40 bg-primary/5 text-primary")}
                          aria-label={t("editor.variables.insert", { name: variable.key })}
                          onClick={() => insertVariable(variable.key)}
                        />
                      }
                    >
                      {variable.key}
                    </TooltipTrigger>
                    <TooltipContent>{tm(variable.descriptionKey)}</TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <header className="space-y-1">
            <h2 className="font-heading text-base leading-snug font-medium">{t("editor.preview.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("editor.preview.description")}</p>
          </header>

          {body.trim().length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("editor.preview.empty")}</p>
          ) : (
            <div className="space-y-3">
              {subjectPreview ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t("editor.preview.subject")}</p>
                  <p className="text-sm font-medium">{subjectPreview.text}</p>
                </div>
              ) : null}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t("editor.preview.body")}</p>
                <p className="max-h-96 overflow-y-auto rounded-lg bg-muted/40 p-3 text-sm whitespace-pre-wrap">{preview.text}</p>
              </div>
              {preview.missing.length > 0 ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">{t("editor.preview.missing", { names: preview.missing.join(", ") })}</p>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
