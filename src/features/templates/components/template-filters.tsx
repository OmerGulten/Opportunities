"use client";

import { FilterX, Search } from "lucide-react";
import { parseAsString, useQueryStates } from "nuqs";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MESSAGE_CHANNELS } from "@/features/messages/components/options";
import { useT } from "@/lib/i18n/client";

const ALL = "__all__";
const NO_SERVICE = "__none__";

export interface TemplateServiceOption {
  id: string;
  name: string;
}

export interface TemplateFiltersProps {
  services: TemplateServiceOption[];
}

/**
 * Template list filters. Kept in the URL (nuqs, `shallow: false`) so a filtered
 * view is shareable and survives navigating away and back.
 */
export function TemplateFilters({ services }: TemplateFiltersProps) {
  const t = useT("templates");
  const tc = useT("common");

  const [filters, setFilters] = useQueryStates(
    { channel: parseAsString, serviceId: parseAsString, q: parseAsString },
    { shallow: false, history: "push" },
  );

  const hasFilters = Boolean(filters.channel || filters.serviceId || filters.q);

  // Base UI needs a value -> label map to render the trigger's text.
  const channelItems: Record<string, string> = { [ALL]: t("filters.all"), ...Object.fromEntries(MESSAGE_CHANNELS.map((c) => [c, tc(`channel.${c}`)])) };
  const serviceItems: Record<string, string> = {
    [ALL]: t("filters.all"),
    [NO_SERVICE]: t("filters.noService"),
    ...Object.fromEntries(services.map((service) => [service.id, service.name])),
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-56 flex-col gap-1.5">
        <Label htmlFor="templates-filter-q" className="text-xs text-muted-foreground">
          {t("filters.search")}
        </Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="templates-filter-q"
            // Remounts when the URL value changes, so "clear filters" empties it.
            key={filters.q ?? ""}
            className="pl-8"
            defaultValue={filters.q ?? ""}
            placeholder={t("filters.searchPlaceholder")}
            // Committed on blur / Enter rather than on every keystroke: each
            // change is a server round-trip and a history entry.
            onBlur={(event) => void setFilters({ q: event.target.value.trim() || null })}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void setFilters({ q: event.currentTarget.value.trim() || null });
              }
            }}
          />
        </div>
      </div>

      <div className="flex min-w-40 flex-col gap-1.5">
        <Label htmlFor="templates-filter-channel" className="text-xs text-muted-foreground">
          {t("filters.channel")}
        </Label>
        <Select
          items={channelItems}
          value={filters.channel ?? ALL}
          onValueChange={(value) => {
            if (typeof value === "string") void setFilters({ channel: value === ALL ? null : value });
          }}
        >
          <SelectTrigger id="templates-filter-channel" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filters.all")}</SelectItem>
            {MESSAGE_CHANNELS.map((channel) => (
              <SelectItem key={channel} value={channel}>
                {tc(`channel.${channel}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-w-48 flex-col gap-1.5">
        <Label htmlFor="templates-filter-service" className="text-xs text-muted-foreground">
          {t("filters.service")}
        </Label>
        <Select
          items={serviceItems}
          value={filters.serviceId ?? ALL}
          onValueChange={(value) => {
            if (typeof value === "string") void setFilters({ serviceId: value === ALL ? null : value });
          }}
        >
          <SelectTrigger id="templates-filter-service" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filters.all")}</SelectItem>
            <SelectItem value={NO_SERVICE}>{t("filters.noService")}</SelectItem>
            {services.map((service) => (
              <SelectItem key={service.id} value={service.id}>
                {service.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasFilters ? (
        <Button variant="ghost" size="sm" onClick={() => void setFilters({ channel: null, serviceId: null, q: null })}>
          <FilterX />
          {t("filters.clear")}
        </Button>
      ) : null}
    </div>
  );
}

/** Sentinel the list page uses for "templates with no service". */
export const TEMPLATE_FILTER_NO_SERVICE = NO_SERVICE;
