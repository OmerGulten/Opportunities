"use client";

import { Coins, Save, Undo2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { EmptyState, InlineAlert } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { updateCreditPricingAction } from "@/features/admin/actions";
import { useFormatters, useT } from "@/lib/i18n/client";

const MIN_COST = 0;
const MAX_COST = 1000;

export interface AdminCreditRuleItem {
  id: string;
  key: string;
  name: string;
  unit: "per_business" | "per_message" | "per_report" | "per_scan";
  cost: number;
  active: boolean;
}

interface Draft {
  cost: string;
  active: boolean;
}

function toDraft(items: AdminCreditRuleItem[]): Record<string, Draft> {
  return Object.fromEntries(items.map((item) => [item.key, { cost: String(item.cost), active: item.active }]));
}

/**
 * Credit cost per operation.
 *
 * Only rows that actually changed are sent, and the new cost applies to future
 * operations only — a running scan settles against the credits it reserved.
 */
export function CreditRulesEditor({ items }: { items: AdminCreditRuleItem[] }) {
  const t = useT("admin");
  const { number } = useFormatters();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Record<string, Draft>>(() => toDraft(items));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function update(key: string, patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  }

  const changed = items.filter((item) => {
    const entry = draft[item.key];
    if (!entry) return false;
    const cost = Number(entry.cost);
    return (Number.isInteger(cost) && cost !== item.cost) || entry.active !== item.active;
  });

  const invalid = items.some((item) => {
    const entry = draft[item.key];
    if (!entry) return false;
    const cost = Number(entry.cost);
    return !Number.isInteger(cost) || cost < MIN_COST || cost > MAX_COST;
  });

  function reset() {
    setDraft(toDraft(items));
    setErrorMessage(null);
  }

  function save() {
    setErrorMessage(null);
    const payload = changed.map((item) => ({ key: item.key, cost: Number(draft[item.key].cost), active: draft[item.key].active }));
    if (payload.length === 0) return;

    startTransition(async () => {
      const result = await updateCreditPricingAction({ rules: payload });
      if (!result.ok) {
        setErrorMessage(result.error.message);
        return;
      }
      toast.success(t("creditRules.savedCount", { count: number(result.data.updated) }));
    });
  }

  if (items.length === 0) {
    return <EmptyState icon={<Coins />} title={t("creditRules.empty")} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <InlineAlert tone="attention">{t("creditRules.notice")}</InlineAlert>

      <div className="w-full overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead>{t("creditRules.columns.name")}</TableHead>
              <TableHead>{t("creditRules.columns.key")}</TableHead>
              <TableHead>{t("creditRules.columns.unit")}</TableHead>
              <TableHead className="text-right">{t("creditRules.columns.cost")}</TableHead>
              <TableHead className="text-right">{t("creditRules.columns.active")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const entry = draft[item.key] ?? { cost: String(item.cost), active: item.active };
              const cost = Number(entry.cost);
              const rowInvalid = !Number.isInteger(cost) || cost < MIN_COST || cost > MAX_COST;
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{item.key}</TableCell>
                  <TableCell className="text-muted-foreground">{t(`creditRules.units.${item.unit}`)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-1">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={MIN_COST}
                        max={MAX_COST}
                        step={1}
                        className="w-24 text-right"
                        value={entry.cost}
                        onChange={(event) => update(item.key, { cost: event.target.value })}
                        aria-label={`${item.name} — ${t("creditRules.columns.cost")}`}
                        aria-invalid={rowInvalid ? true : undefined}
                        disabled={pending}
                      />
                      {rowInvalid ? <span className="text-xs text-destructive">{t("creditRules.costHint")}</span> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Label htmlFor={`credit-rule-active-${item.id}`} className="text-xs text-muted-foreground">
                        {entry.active ? t("common.active") : t("common.inactive")}
                      </Label>
                      <Switch
                        id={`credit-rule-active-${item.id}`}
                        checked={entry.active}
                        onCheckedChange={(checked) => update(item.key, { active: checked === true })}
                        disabled={pending}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {errorMessage ? <InlineAlert tone="negative">{errorMessage}</InlineAlert> : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <p className="mr-auto text-sm text-muted-foreground">
          {changed.length === 0 ? t("common.noChanges") : t("common.unsaved", { count: number(changed.length) })}
        </p>
        <Button variant="ghost" size="sm" onClick={reset} disabled={pending || changed.length === 0}>
          <Undo2 />
          {t("common.discard")}
        </Button>
        <Button size="sm" onClick={save} disabled={pending || invalid || changed.length === 0}>
          {pending ? <Spinner /> : <Save />}
          {pending ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </div>
  );
}
