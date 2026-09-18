"use client";

import { cn } from "cn";
import { CircleCheck, FlaskConical, Lock } from "lucide-react";

import { InlineAlert } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { useT } from "@/lib/i18n/client";

export interface IntegrationStatusItem {
  /** Key under `settings.integrations.providers`. */
  key: string;
  /** Name of the environment variable that enables the live provider. */
  envVar: string;
  configured: boolean;
  /** True when demo / mock behaviour is in effect for this provider. */
  demo: boolean;
  /** Non-secret configuration detail, e.g. the model name. */
  detail?: string | null;
}

export interface IntegrationsStatusProps {
  items: IntegrationStatusItem[];
  /** DEMO_MODE=true overrides every provider. */
  forcedDemo: boolean;
  /** Shown when the performance provider falls back to heuristics. */
  heuristicPerformance: boolean;
}

/**
 * Read-only provider status.
 *
 * Only the *name* of the environment variable and whether it is set is shown —
 * never a value, a prefix or a masked form of a secret.
 */
export function IntegrationsStatus({ items, forcedDemo, heuristicPerformance }: IntegrationsStatusProps) {
  const t = useT("settings");

  return (
    <div className="flex flex-col gap-4">
      <InlineAlert tone="neutral" icon={<Lock className="size-4" />}>
        {t("integrations.secretsNotice")}
      </InlineAlert>

      {forcedDemo ? (
        <InlineAlert tone="attention" icon={<FlaskConical className="size-4 text-amber-600 dark:text-amber-400" />}>
          {t("integrations.forcedDemo")}
        </InlineAlert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("integrations.title")}</CardTitle>
          <CardDescription>{t("integrations.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {items.map((item) => (
            <Item key={item.key} variant="outline" className="items-start">
              <ItemContent>
                <ItemTitle className="flex flex-wrap items-center gap-2">
                  {t(`integrations.providers.${item.key}.name`)}
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-normal",
                      item.demo
                        ? "border-amber-600/25 bg-amber-500/14 text-amber-700 dark:border-amber-400/25 dark:text-amber-300"
                        : "border-emerald-600/25 bg-emerald-500/12 text-emerald-700 dark:border-emerald-400/25 dark:text-emerald-300",
                    )}
                  >
                    {item.demo ? <FlaskConical className="size-3" /> : <CircleCheck className="size-3" />}
                    {item.demo ? t("integrations.status.demo") : t("integrations.status.live")}
                  </Badge>
                </ItemTitle>
                <ItemDescription>{t(`integrations.providers.${item.key}.description`)}</ItemDescription>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{t("integrations.envVar")}</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{item.envVar}</code>
                  <Badge variant="outline" className="font-normal">
                    {item.configured ? t("integrations.status.configured") : t("integrations.status.notConfigured")}
                  </Badge>
                  {item.detail ? (
                    <span>
                      {t("integrations.model")}: <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{item.detail}</code>
                    </span>
                  ) : null}
                </div>
                {!item.configured ? <p className="mt-1 text-xs text-muted-foreground">{t("integrations.missingHint")}</p> : null}
              </ItemContent>
            </Item>
          ))}
        </CardContent>
      </Card>

      {heuristicPerformance ? <p className="text-xs text-muted-foreground">{t("integrations.heuristicNotice")}</p> : null}
    </div>
  );
}
