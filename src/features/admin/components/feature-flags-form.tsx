"use client";

import { Save, Undo2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { InlineAlert } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { updateFeatureFlagsAction } from "@/features/admin/actions";
import { useFormatters, useT } from "@/lib/i18n/client";

const KNOWN_FLAGS = [
  "real_payments",
  "competitor_benchmark",
  "pagespeed",
  "instagram_discovery",
  "export_provider_content",
  "public_reports",
  "api_keys",
] as const;

export interface FeatureFlagsFormProps {
  /** Effective flags: stored values merged over the defaults. */
  flags: Record<string, boolean>;
}

/** Batched feature-flag toggles. Only the flags that changed are sent. */
export function FeatureFlagsForm({ flags }: FeatureFlagsFormProps) {
  const t = useT("admin");
  const { number } = useFormatters();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Record<string, boolean>>(() => ({ ...flags }));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const keys = [...new Set<string>([...KNOWN_FLAGS, ...Object.keys(flags)])];
  const changedKeys = keys.filter((key) => (draft[key] ?? false) !== (flags[key] ?? false));

  function reset() {
    setDraft({ ...flags });
    setErrorMessage(null);
  }

  function save() {
    if (changedKeys.length === 0) return;
    setErrorMessage(null);
    const payload = Object.fromEntries(changedKeys.map((key) => [key, draft[key] ?? false]));

    startTransition(async () => {
      const result = await updateFeatureFlagsAction({ flags: payload });
      if (!result.ok) {
        setErrorMessage(result.error.message);
        return;
      }
      toast.success(t("flags.saved"));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        {keys.map((key) => {
          const known = (KNOWN_FLAGS as readonly string[]).includes(key);
          const label = known ? t(`flags.labels.${key}`) : key;
          const hint = known ? t(`flags.hints.${key}`) : t("flags.unknownFlag");
          const checked = draft[key] ?? false;
          return (
            <Card key={key} size="sm">
              <CardContent className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <Label htmlFor={`flag-${key}`} className="text-sm font-medium">
                    {label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{hint}</p>
                  <p className="font-mono text-[0.7rem] text-muted-foreground/70">{key}</p>
                </div>
                <Switch
                  id={`flag-${key}`}
                  checked={checked}
                  onCheckedChange={(next) => setDraft((current) => ({ ...current, [key]: next === true }))}
                  disabled={pending}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {errorMessage ? <InlineAlert tone="negative">{errorMessage}</InlineAlert> : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <p className="mr-auto text-sm text-muted-foreground">
          {changedKeys.length === 0 ? t("common.noChanges") : t("common.unsaved", { count: number(changedKeys.length) })}
        </p>
        <Button variant="ghost" size="sm" onClick={reset} disabled={pending || changedKeys.length === 0}>
          <Undo2 />
          {t("common.discard")}
        </Button>
        <Button size="sm" onClick={save} disabled={pending || changedKeys.length === 0}>
          {pending ? <Spinner /> : <Save />}
          {pending ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </div>
  );
}
