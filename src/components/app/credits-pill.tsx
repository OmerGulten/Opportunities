import { cn } from "cn";
import { Coins } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getWorkspaceContext } from "@/lib/auth/context";
import { getT } from "@/lib/i18n";
import { formatNumber } from "@/lib/utils/format";
import type { CreditAccountRow } from "@/types/db";

export interface CreditsPillProps {
  className?: string;
}

/**
 * Available credit balance for the current workspace, read through the
 * RLS-scoped client. Shows a neutral dash when the account row is not
 * readable rather than implying a zero balance.
 *
 * An unlimited account keeps a balance of 0 — it is never billed, so the
 * number would be meaningless here. The pill says "unlimited" instead of
 * showing a zero that reads like an empty account.
 */
export async function CreditsPill({ className }: CreditsPillProps) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return null;

  const { data } = await ctx.supabase
    .from("credit_accounts")
    .select("balance, reserved, unlimited")
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<Pick<CreditAccountRow, "balance" | "reserved" | "unlimited">>();

  const t = getT(ctx.locale, "nav");
  const tc = getT(ctx.locale, "common");
  const unlimited = data?.unlimited === true;
  const label = unlimited ? tc("credits.unlimited") : data ? formatNumber(data.balance, ctx.locale) : "–";

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("gap-1.5 font-medium tabular-nums", className)}
      render={<Link href="/settings/billing" aria-label={`${t("credits")}: ${label}`} />}
    >
      <Coins className="text-primary" />
      <span>{label}</span>
      <span className="hidden text-muted-foreground sm:inline">{tc("units.credits")}</span>
    </Button>
  );
}
