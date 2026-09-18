"use client";

import { Save, SlidersHorizontal, Undo2 } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { EmptyState, InlineAlert, Section, ServiceIcon } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { updateScoringRuleAction } from "@/features/admin/actions";
import { useFormatters, useT } from "@/lib/i18n/client";
import type { AuditDepth, ConfidenceLevel } from "@/types/common";

const MIN_POINTS = 0;
const MAX_POINTS = 100;
const CONFIDENCE_LEVELS: ConfidenceLevel[] = ["high", "medium", "low"];
const DEPTHS: AuditDepth[] = ["discovery", "basic", "deep"];

export interface AdminScoringRuleItem {
  id: string;
  key: string;
  name: string;
  explanation: string | null;
  signalType: string;
  operator: string;
  points: number;
  minConfidence: ConfidenceLevel;
  requiresDepth: AuditDepth;
  active: boolean;
  version: number;
}

export interface AdminScoringRuleGroup {
  serviceId: string;
  serviceKey: string;
  serviceName: string;
  serviceIcon: string | null;
  serviceActive: boolean;
  rules: AdminScoringRuleItem[];
}

interface Draft {
  points: string;
  minConfidence: ConfidenceLevel;
  requiresDepth: AuditDepth;
  active: boolean;
}

function toDraft(groups: AdminScoringRuleGroup[]): Record<string, Draft> {
  const entries: Array<[string, Draft]> = [];
  for (const group of groups) {
    for (const rule of group.rules) {
      entries.push([
        rule.id,
        { points: String(rule.points), minConfidence: rule.minConfidence, requiresDepth: rule.requiresDepth, active: rule.active },
      ]);
    }
  }
  return Object.fromEntries(entries);
}

function isConfidence(value: unknown): value is ConfidenceLevel {
  return value === "high" || value === "medium" || value === "low";
}

function isDepth(value: unknown): value is AuditDepth {
  return value === "discovery" || value === "basic" || value === "deep";
}

export interface ScoringRulesEditorProps {
  groups: AdminScoringRuleGroup[];
  /** All services, for the filter — including ones with no rules. */
  services: Array<{ id: string; name: string }>;
  /** The service filter the server applied, mirrored from the URL. */
  selectedServiceId: string;
}

/**
 * Editor for the per-service scoring rules.
 *
 * Saving bumps `service_rules.version` server side. Existing opportunities keep
 * the version they were scored with, so nothing that has already been shown to
 * a customer is rewritten — the notice says so in plain words.
 */
export function ScoringRulesEditor({ groups, services, selectedServiceId }: ScoringRulesEditorProps) {
  const t = useT("admin");
  const tc = useT("common");
  const { number } = useFormatters();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Record<string, Draft>>(() => toDraft(groups));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [, setService] = useQueryState(
    "service",
    parseAsString.withDefault("").withOptions({ shallow: false, startTransition, clearOnDefault: true }),
  );

  function update(id: string, patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  const allRules = groups.flatMap((group) => group.rules);

  const changed = allRules.filter((rule) => {
    const entry = draft[rule.id];
    if (!entry) return false;
    const points = Number(entry.points);
    return (
      (Number.isInteger(points) && points !== rule.points) ||
      entry.minConfidence !== rule.minConfidence ||
      entry.requiresDepth !== rule.requiresDepth ||
      entry.active !== rule.active
    );
  });

  const invalid = allRules.some((rule) => {
    const entry = draft[rule.id];
    if (!entry) return false;
    const points = Number(entry.points);
    return !Number.isInteger(points) || points < MIN_POINTS || points > MAX_POINTS;
  });

  function reset() {
    setDraft(toDraft(groups));
    setErrorMessage(null);
  }

  function save() {
    if (changed.length === 0) return;
    setErrorMessage(null);

    startTransition(async () => {
      let saved = 0;
      let failure: string | null = null;
      for (const rule of changed) {
        const entry = draft[rule.id];
        const result = await updateScoringRuleAction({
          ruleId: rule.id,
          points: Number(entry.points),
          active: entry.active,
          minConfidence: entry.minConfidence,
          requiresDepth: entry.requiresDepth,
        });
        if (result.ok) saved += 1;
        else {
          failure = result.error.message;
          break;
        }
      }
      if (saved > 0) toast.success(t("scoringRules.saved", { count: number(saved) }));
      if (failure) setErrorMessage(failure);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <InlineAlert tone="attention">{t("scoringRules.versionNotice")}</InlineAlert>

      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="scoring-service-filter" className="text-sm text-muted-foreground">
          {t("scoringRules.selectService")}
        </Label>
        <Select
          value={selectedServiceId === "" ? "all" : selectedServiceId}
          onValueChange={(value) => {
            if (typeof value !== "string") return;
            void setService(value === "all" ? null : value);
          }}
        >
          <SelectTrigger id="scoring-service-filter" size="sm" className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("scoringRules.allServices")}</SelectItem>
            {services.map((service) => (
              <SelectItem key={service.id} value={service.id}>
                {service.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {groups.length === 0 || allRules.length === 0 ? (
        <EmptyState icon={<SlidersHorizontal />} title={t("scoringRules.empty")} />
      ) : (
        groups.map((group) => (
          <Section
            key={group.serviceId}
            title={
              <span className="flex items-center gap-2">
                <ServiceIcon icon={group.serviceIcon} colored className="size-4" />
                {group.serviceName}
                {group.serviceActive ? null : (
                  <Badge variant="outline" className="border-slate-500/25 bg-slate-500/10 text-slate-700 dark:border-slate-400/20 dark:text-slate-300">
                    {t("common.inactive")}
                  </Badge>
                )}
              </span>
            }
          >
            <div className="w-full overflow-hidden rounded-xl ring-1 ring-foreground/10">
              <Table className="min-w-[56rem]">
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t("scoringRules.columns.rule")}</TableHead>
                    <TableHead>{t("scoringRules.columns.signal")}</TableHead>
                    <TableHead className="w-24 text-right">{t("scoringRules.columns.points")}</TableHead>
                    <TableHead className="w-40">{t("scoringRules.columns.minConfidence")}</TableHead>
                    <TableHead className="w-44">{t("scoringRules.columns.requiresDepth")}</TableHead>
                    <TableHead className="w-20 text-right">{t("scoringRules.columns.version")}</TableHead>
                    <TableHead className="w-28 text-right">{t("scoringRules.columns.active")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.rules.map((rule) => {
                    const entry =
                      draft[rule.id] ?? {
                        points: String(rule.points),
                        minConfidence: rule.minConfidence,
                        requiresDepth: rule.requiresDepth,
                        active: rule.active,
                      };
                    const points = Number(entry.points);
                    const rowInvalid = !Number.isInteger(points) || points < MIN_POINTS || points > MAX_POINTS;
                    return (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <div className="min-w-0 max-w-sm">
                            <p className="font-medium">{rule.name}</p>
                            <p className="font-mono text-xs text-muted-foreground">{rule.key}</p>
                            {rule.explanation ? <p className="mt-1 text-xs text-muted-foreground">{rule.explanation}</p> : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-mono text-xs text-muted-foreground">{rule.signalType}</p>
                          <p className="font-mono text-xs text-muted-foreground/70">{rule.operator}</p>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={MIN_POINTS}
                              max={MAX_POINTS}
                              step={1}
                              className="w-20 text-right"
                              value={entry.points}
                              onChange={(event) => update(rule.id, { points: event.target.value })}
                              aria-label={`${rule.name} — ${t("scoringRules.columns.points")}`}
                              aria-invalid={rowInvalid ? true : undefined}
                              disabled={pending}
                            />
                            {rowInvalid ? <span className="text-xs text-destructive">{t("scoringRules.pointsHint")}</span> : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={entry.minConfidence}
                            onValueChange={(value) => {
                              if (isConfidence(value)) update(rule.id, { minConfidence: value });
                            }}
                          >
                            <SelectTrigger size="sm" className="w-full" aria-label={`${rule.name} — ${t("scoringRules.columns.minConfidence")}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CONFIDENCE_LEVELS.map((level) => (
                                <SelectItem key={level} value={level}>
                                  {tc(`confidence.${level}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={entry.requiresDepth}
                            onValueChange={(value) => {
                              if (isDepth(value)) update(rule.id, { requiresDepth: value });
                            }}
                          >
                            <SelectTrigger size="sm" className="w-full" aria-label={`${rule.name} — ${t("scoringRules.columns.requiresDepth")}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DEPTHS.map((depth) => (
                                <SelectItem key={depth} value={depth}>
                                  {tc(`depth.${depth}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="font-mono text-[0.7rem] text-muted-foreground">
                            {t("scoringRules.versionValue", { version: rule.version })}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Switch
                            checked={entry.active}
                            onCheckedChange={(checked) => update(rule.id, { active: checked === true })}
                            disabled={pending}
                            aria-label={`${rule.name} — ${t("scoringRules.columns.active")}`}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Section>
        ))
      )}

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
