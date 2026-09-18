"use client";

import { cn } from "cn";
import { Coins, Grid2x2, Store, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { InlineAlert, NotExhaustiveNotice } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { ScanEstimate } from "@/features/scans/service";
import { useFormatters, useT } from "@/lib/i18n/client";

import { CoverageNotes } from "./coverage-notes";

export type EstimateStatus = "idle" | "loading" | "ready" | "error";

export interface CreditEstimatePanelProps {
  estimate: ScanEstimate | null;
  status: EstimateStatus;
  /** AppError code from the estimate request, mapped through the errors namespace. */
  errorCode?: string | null;
  /** `compact` is the wizard sidebar; `full` adds coverage and the breakdown. */
  variant?: "compact" | "full";
  className?: string;
}

/**
 * Coverage and credit estimate. Numbers are what the server planner and the
 * pricing table produced — the panel never extrapolates beyond them, and it
 * says plainly when the balance is short.
 */
export function CreditEstimatePanel({ estimate, status, errorCode, variant = "compact", className }: CreditEstimatePanelProps) {
  const t = useT("scans");
  const te = useT("errors");
  const { number } = useFormatters();

  if (status === "error") {
    return (
      <div className={cn("panel p-4", className)}>
        <InlineAlert tone="attention" title={t("estimate.failedTitle")}>
          {errorCode ? te(errorCode) : te("generic")}
        </InlineAlert>
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className={cn("panel flex flex-col gap-3 p-4", className)}>
        <p className="text-sm font-medium">{t("estimate.title")}</p>
        {status === "loading" ? (
          <div className="flex flex-col gap-2" aria-busy>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("estimate.empty")}</p>
        )}
      </div>
    );
  }

  const remaining = estimate.balance.available - estimate.total;

  return (
    <div className={cn("panel flex flex-col gap-4 p-4", status === "loading" && "opacity-60 transition-opacity", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{t("estimate.title")}</p>
        {status === "loading" ? <span className="text-xs text-muted-foreground">{t("estimate.refreshing")}</span> : null}
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <EstimateFigure icon={<Grid2x2 className="size-3.5" />} label={t("estimate.cells")} value={number(estimate.cells)} />
        <EstimateFigure
          icon={<Store className="size-3.5" />}
          label={t("estimate.businesses")}
          value={number(estimate.estimatedBusinesses)}
        />
        <EstimateFigure
          icon={<Coins className="size-3.5" />}
          label={t("estimate.totalCredits")}
          value={number(estimate.total)}
        />
        <EstimateFigure
          label={t("estimate.areaKm2")}
          value={estimate.areaKm2 === null ? t("estimate.areaUnknown") : number(estimate.areaKm2, { maximumFractionDigits: 1 })}
        />
      </dl>

      <p className="text-xs text-muted-foreground">{t("estimate.disclaimer")}</p>

      {variant === "full" ? (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{t("estimate.breakdownTitle")}</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th scope="col" className="py-1 text-left font-normal">
                    {t("estimate.line")}
                  </th>
                  <th scope="col" className="py-1 text-right font-normal">
                    {t("estimate.unitCost")}
                  </th>
                  <th scope="col" className="py-1 text-right font-normal">
                    {t("estimate.quantity")}
                  </th>
                  <th scope="col" className="py-1 text-right font-normal">
                    {t("estimate.lineTotal")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {estimate.breakdown.map((line) => (
                  <tr key={line.key} className="border-t border-border/60">
                    <td className="py-1.5">{t(`pricing.${line.key}`)}</td>
                    <td className="py-1.5 text-right tabular-nums">{number(line.unitCost)}</td>
                    <td className="py-1.5 text-right tabular-nums">{number(line.quantity)}</td>
                    <td className="py-1.5 text-right font-medium tabular-nums">{number(line.total)}</td>
                  </tr>
                ))}
                <tr className="border-t border-border">
                  <td className="py-1.5 font-medium" colSpan={3}>
                    {t("estimate.totalCredits")}
                  </td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">{number(estimate.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {estimate.coverageNotes.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium">{t("coverage.title")}</p>
              <CoverageNotes notes={estimate.coverageNotes} />
            </div>
          ) : null}

          <NotExhaustiveNotice />
        </>
      ) : null}

      <Separator />

      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">{t("estimate.balance")}</dt>
          <dd className="tabular-nums">{number(estimate.balance.available)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">{t("estimate.afterScan")}</dt>
          <dd className={cn("font-medium tabular-nums", !estimate.sufficient && "text-destructive")}>{number(remaining)}</dd>
        </div>
      </dl>

      {!estimate.sufficient ? (
        <InlineAlert
          tone="negative"
          icon={<TriangleAlert className="size-4" />}
          title={t("estimate.insufficientTitle")}
          action={
            <Button size="sm" variant="outline" render={<Link href="/settings/billing" />}>
              {t("estimate.buyCredits")}
            </Button>
          }
        >
          {t("estimate.insufficientBody", {
            required: number(estimate.total),
            available: number(estimate.balance.available),
            missing: number(Math.abs(remaining)),
          })}
        </InlineAlert>
      ) : null}
    </div>
  );
}

function EstimateFigure({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </dt>
      <dd className="font-heading text-lg leading-tight font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
