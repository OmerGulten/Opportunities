import { cn } from "cn";
import { AtSign, Globe, MapPin, MessageSquare, Palette, Search, Sparkles } from "lucide-react";
import type { ComponentType } from "react";

import { Badge } from "@/components/ui/badge";

type IconComponent = ComponentType<{ className?: string }>;

/**
 * Icon keys come from the `services.icon` column (see supabase/seed.sql).
 * lucide-react no longer ships brand marks, so the social icon is a neutral
 * handle glyph rather than a platform logo.
 */
const serviceIcons: Record<string, IconComponent> = {
  globe: Globe,
  search: Search,
  instagram: AtSign,
  "map-pin": MapPin,
  "message-square": MessageSquare,
  palette: Palette,
};

/** Chart hue per service slot, so a service keeps one colour across the app. */
const serviceAccent: Record<string, string> = {
  globe: "text-chart-1",
  search: "text-chart-2",
  instagram: "text-chart-3",
  "map-pin": "text-chart-4",
  "message-square": "text-chart-5",
  palette: "text-chart-3",
};

export interface ServiceIconProps {
  /** `services.icon` value; unknown keys fall back to a neutral glyph. */
  icon: string | null | undefined;
  /** Tint the icon with the service hue. */
  colored?: boolean;
  className?: string;
}

export function ServiceIcon({ icon, colored = false, className }: ServiceIconProps) {
  const key = icon ?? "";
  const Icon = serviceIcons[key] ?? Sparkles;
  return <Icon className={cn("size-4", colored ? (serviceAccent[key] ?? "text-muted-foreground") : undefined, className)} />;
}

export interface ServiceBadgeProps {
  /** Already-localized service name (use pickLocalized / localizedName). */
  name: string;
  icon?: string | null;
  className?: string;
}

export function ServiceBadge({ name, icon, className }: ServiceBadgeProps) {
  return (
    <Badge variant="outline" className={cn("gap-1 font-normal", className)}>
      <ServiceIcon icon={icon} colored className="size-3" />
      {name}
    </Badge>
  );
}
