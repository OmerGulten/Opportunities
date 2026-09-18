"use client";

import { cn } from "cn";
import { CircleSlash, Eye, Info, Sigma, TriangleAlert } from "lucide-react";
import type { ComponentType } from "react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useT } from "@/lib/i18n/client";
import type { FindingSeverity } from "@/types/audits";
import type { ConfidenceLevel, EvidenceType } from "@/types/common";

import { confidenceTone, evidenceTone, severityTone, toneBadgeClass } from "./tokens";

type IconComponent = ComponentType<{ className?: string }>;

const evidenceIcon: Record<EvidenceType, IconComponent> = {
  observed: Eye,
  derived: Sigma,
  heuristic: TriangleAlert,
  unavailable: CircleSlash,
};

export interface EvidenceTypeBadgeProps {
  evidenceType: EvidenceType;
  /** Disable the explanation tooltip (for example inside another tooltip). */
  withTooltip?: boolean;
  className?: string;
}

/**
 * How a fact was obtained. The tooltip spells out what the label means so a
 * heuristic result is never mistaken for a measurement.
 */
export function EvidenceTypeBadge({ evidenceType, withTooltip = true, className }: EvidenceTypeBadgeProps) {
  const t = useT("common");
  const Icon = evidenceIcon[evidenceType];
  const badge = (
    <Badge variant="outline" className={cn(toneBadgeClass[evidenceTone[evidenceType]], className)}>
      <Icon className="size-3" />
      {t(`evidence.${evidenceType}`)}
    </Badge>
  );

  if (!withTooltip) return badge;

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>{badge}</TooltipTrigger>
      <TooltipContent>{t(`evidence.hint.${evidenceType}`)}</TooltipContent>
    </Tooltip>
  );
}

export interface ConfidenceBadgeProps {
  confidence: ConfidenceLevel;
  /** Prefix the value with the "Confidence" label. */
  withLabel?: boolean;
  className?: string;
}

export function ConfidenceBadge({ confidence, withLabel = false, className }: ConfidenceBadgeProps) {
  const t = useT("common");
  return (
    <Badge variant="outline" className={cn(toneBadgeClass[confidenceTone[confidence]], className)}>
      {withLabel ? <span className="text-muted-foreground">{t("confidence.label")}</span> : null}
      {t(`confidence.${confidence}`)}
    </Badge>
  );
}

export interface SeverityBadgeProps {
  severity: FindingSeverity;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const t = useT("common");
  return (
    <Badge variant="outline" className={cn(toneBadgeClass[severityTone[severity]], className)}>
      {severity === "info" ? <Info className="size-3" /> : null}
      {t(`severity.${severity}`)}
    </Badge>
  );
}
