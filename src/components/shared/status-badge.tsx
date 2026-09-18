"use client";

import { cn } from "cn";
import { CircleAlert, CircleCheck, CircleDashed, CircleHelp, CircleSlash, CircleX, Globe, TriangleAlert } from "lucide-react";
import type { ComponentType } from "react";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/client";
import type { ObservationStatus } from "@/types/common";
import type { WebsiteStatus } from "@/types/signals";

import { observationTone, toneBadgeClass, websiteStatusTone } from "./tokens";

type IconComponent = ComponentType<{ className?: string }>;

const observationIcon: Record<ObservationStatus, IconComponent> = {
  found: CircleCheck,
  not_found: CircleX,
  not_checked: CircleDashed,
  unavailable: CircleSlash,
  error: TriangleAlert,
  ambiguous: CircleHelp,
};

const websiteStatusIcon: Record<WebsiteStatus, IconComponent> = {
  found: CircleCheck,
  not_found: CircleX,
  unreachable: CircleSlash,
  redirected: CircleAlert,
  invalid: TriangleAlert,
  not_checked: CircleDashed,
};

export interface StatusBadgeProps {
  status: ObservationStatus;
  /** Hide the icon when the badge sits in a dense table cell. */
  showIcon?: boolean;
  className?: string;
}

/**
 * Renders an explicit observation status. `not_checked` is never shown as
 * `not_found`: each status keeps its own colour, icon and label.
 */
export function StatusBadge({ status, showIcon = true, className }: StatusBadgeProps) {
  const t = useT("common");
  const Icon = observationIcon[status];
  return (
    <Badge variant="outline" className={cn(toneBadgeClass[observationTone[status]], className)}>
      {showIcon ? <Icon className="size-3" /> : null}
      {t(`observation.${status}`)}
    </Badge>
  );
}

export interface WebsiteStatusBadgeProps {
  status: WebsiteStatus;
  showIcon?: boolean;
  className?: string;
}

/** Website reachability status with its own vocabulary (redirected, invalid…). */
export function WebsiteStatusBadge({ status, showIcon = true, className }: WebsiteStatusBadgeProps) {
  const t = useT("common");
  const Icon = status === "found" ? Globe : websiteStatusIcon[status];
  return (
    <Badge variant="outline" className={cn(toneBadgeClass[websiteStatusTone[status]], className)}>
      {showIcon ? <Icon className="size-3" /> : null}
      {t(`websiteStatus.${status}`)}
    </Badge>
  );
}
