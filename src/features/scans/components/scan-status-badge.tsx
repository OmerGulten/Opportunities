"use client";

import { cn } from "cn";
import {
  CircleCheck,
  CircleDashed,
  CircleSlash,
  CircleX,
  ClipboardCheck,
  Clock,
  Gauge,
  Layers,
  Radar,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type { ComponentType } from "react";

import { toneBadgeClass, type Tone } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/client";
import type { ScanStatus } from "@/types/common";

type IconComponent = ComponentType<{ className?: string }>;

const statusTone: Record<ScanStatus, Tone> = {
  created: "neutral",
  queued: "neutral",
  discovering: "info",
  deduplicating: "info",
  enriching: "info",
  auditing: "info",
  scoring: "info",
  completed: "positive",
  partially_completed: "attention",
  failed: "negative",
  cancelled: "neutral",
};

const statusIcon: Record<ScanStatus, IconComponent> = {
  created: CircleDashed,
  queued: Clock,
  discovering: Radar,
  deduplicating: Layers,
  enriching: Sparkles,
  auditing: ClipboardCheck,
  scoring: Gauge,
  completed: CircleCheck,
  partially_completed: TriangleAlert,
  failed: CircleX,
  cancelled: CircleSlash,
};

export interface ScanStatusBadgeProps {
  status: ScanStatus;
  showIcon?: boolean;
  className?: string;
}

/** Lifecycle state of a scan. Every status keeps its own wording and colour. */
export function ScanStatusBadge({ status, showIcon = true, className }: ScanStatusBadgeProps) {
  const t = useT("scans");
  const Icon = statusIcon[status];

  return (
    <Badge variant="outline" className={cn(toneBadgeClass[statusTone[status]], className)}>
      {showIcon ? <Icon className="size-3" /> : null}
      {t(`status.${status}`)}
    </Badge>
  );
}
