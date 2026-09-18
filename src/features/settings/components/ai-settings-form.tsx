"use client";

import { ExternalLink, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { InlineAlert, KeyValueList } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { updateWorkspace } from "@/features/settings/actions";
import { useFormatters, useT } from "@/lib/i18n/client";
import { TONES } from "@/types/common";

export interface AiSettingsFormProps {
  defaultTone: string;
  canEdit: boolean;
  provider: { name: string; model: string; demo: boolean };
  promptVersion: string;
  maxOutputTokens: number;
  temperature: number;
}

/**
 * Tone is a workspace setting; model, prompt version and generation limits are
 * platform configuration and are therefore shown read-only.
 */
export function AiSettingsForm({ defaultTone, canEdit, provider, promptVersion, maxOutputTokens, temperature }: AiSettingsFormProps) {
  const t = useT("settings");
  const tc = useT("common");
  const router = useRouter();
  const { number } = useFormatters();
  const [pending, startTransition] = useTransition();
  const [tone, setTone] = useState(defaultTone);

  function submit() {
    startTransition(async () => {
      const result = await updateWorkspace({ defaultTone: tone });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t("common.saved"));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {provider.demo ? (
        <InlineAlert tone="attention" title={t("ai.demoNotice")}>
          {t("integrations.forcedDemo")}
        </InlineAlert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("ai.title")}</CardTitle>
          <CardDescription>{t("ai.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Field>
            <FieldLabel htmlFor="ai-tone">{t("ai.defaultTone")}</FieldLabel>
            <Select
              value={tone}
              disabled={!canEdit || pending}
              onValueChange={(value) => {
                if (typeof value === "string") setTone(value);
              }}
            >
              <SelectTrigger id="ai-tone" className="w-full sm:w-64">
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
            <FieldDescription>{t("ai.defaultToneHint")}</FieldDescription>
          </Field>
        </CardContent>
        {canEdit ? (
          <CardFooter className="justify-end">
            <Button onClick={submit} disabled={pending || tone === defaultTone}>
              {pending ? <Spinner /> : null}
              {tc("actions.save")}
            </Button>
          </CardFooter>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t("ai.model")}
            <Badge variant="outline" className="font-normal">
              {t("common.readOnly")}
            </Badge>
          </CardTitle>
          <CardDescription>{t("ai.platformNotice")}</CardDescription>
        </CardHeader>
        <CardContent>
          <KeyValueList
            items={[
              { key: "provider", label: t("ai.provider"), value: <code className="font-mono text-xs">{provider.name}</code> },
              {
                key: "model",
                label: t("ai.model"),
                value: <code className="font-mono text-xs">{provider.model}</code>,
                hint: t("ai.modelHint"),
              },
              { key: "prompt", label: t("ai.promptVersion"), value: <code className="font-mono text-xs">{promptVersion}</code> },
              { key: "tokens", label: t("ai.maxOutputTokens"), value: <span className="tabular-nums">{number(maxOutputTokens)}</span> },
              { key: "temperature", label: t("ai.temperature"), value: <span className="tabular-nums">{number(temperature)}</span> },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            {t("ai.disclosure.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{t("ai.disclosure.body")}</p>
          <div>
            <Button variant="outline" size="sm" render={<Link href="/legal/ai-disclosure" />}>
              <ExternalLink />
              {t("ai.disclosure.link")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
