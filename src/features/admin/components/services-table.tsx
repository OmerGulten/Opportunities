"use client";

import { Wrench } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { EmptyState, InlineAlert, ServiceIcon } from "@/components/shared";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toggleServiceAction } from "@/features/admin/actions";
import { useFormatters, useT } from "@/lib/i18n/client";

export interface AdminServiceItem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  /** `services.icon` column value. */
  icon: string | null;
  /** `null` means the engine derives the 100% mark from the rule points. */
  scoreNormalizer: number | null;
  ruleCount: number;
  active: boolean;
}

/** Enables or disables a sellable service platform-wide. Past scores are untouched. */
export function ServicesTable({ items }: { items: AdminServiceItem[] }) {
  const t = useT("admin");
  const { number } = useFormatters();
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function toggle(item: AdminServiceItem, active: boolean) {
    setErrorMessage(null);
    setPendingId(item.id);
    startTransition(async () => {
      const result = await toggleServiceAction({ serviceId: item.id, active });
      setPendingId(null);
      if (!result.ok) {
        setErrorMessage(result.error.message);
        return;
      }
      toast.success(result.data.active ? t("services.enabled", { service: item.name }) : t("services.disabled", { service: item.name }));
    });
  }

  if (items.length === 0) {
    return <EmptyState icon={<Wrench />} title={t("services.empty")} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <InlineAlert tone="neutral">{t("services.notice")}</InlineAlert>

      <div className="w-full overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead>{t("services.columns.name")}</TableHead>
              <TableHead>{t("services.columns.key")}</TableHead>
              <TableHead className="text-right">{t("services.columns.normalizer")}</TableHead>
              <TableHead className="text-right">{t("services.columns.rules")}</TableHead>
              <TableHead className="text-right">{t("services.columns.active")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="flex min-w-0 items-start gap-2">
                    <ServiceIcon icon={item.icon} colored className="mt-0.5 size-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium">{item.name}</p>
                      {item.description ? <p className="text-xs text-muted-foreground">{item.description}</p> : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{item.key}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {item.scoreNormalizer === null ? (
                    <span className="text-xs text-muted-foreground">{t("services.normalizerAuto")}</span>
                  ) : (
                    number(item.scoreNormalizer)
                  )}
                </TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">{t("services.ruleCount", { count: number(item.ruleCount) })}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {pending && pendingId === item.id ? <Spinner className="size-3.5 text-muted-foreground" /> : null}
                    <Label htmlFor={`service-active-${item.id}`} className="text-xs text-muted-foreground">
                      {item.active ? t("common.active") : t("common.inactive")}
                    </Label>
                    <Switch
                      id={`service-active-${item.id}`}
                      checked={item.active}
                      onCheckedChange={(checked) => toggle(item, checked === true)}
                      disabled={pending}
                      aria-label={t("services.toggleLabel", { service: item.name })}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {errorMessage ? <InlineAlert tone="negative">{errorMessage}</InlineAlert> : null}
    </div>
  );
}
