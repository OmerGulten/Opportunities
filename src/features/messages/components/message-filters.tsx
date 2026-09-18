"use client";

import { FilterX } from "lucide-react";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n/client";

import { MESSAGE_CHANNELS, MESSAGE_STATUSES } from "./options";

const ALL = "__all__";

export interface MessageBusinessOption {
  id: string;
  name: string;
}

export interface MessageFiltersProps {
  businesses: MessageBusinessOption[];
}

/**
 * Drafts list filters. They live in the URL (nuqs, `shallow: false`) so the
 * Server Component re-reads with the new filter, a filtered view can be shared,
 * and going away and back restores it.
 */
export function MessageFilters({ businesses }: MessageFiltersProps) {
  const t = useT("messages");
  const tc = useT("common");

  const [filters, setFilters] = useQueryStates(
    {
      channel: parseAsString,
      status: parseAsString,
      businessId: parseAsString,
      page: parseAsInteger,
    },
    { shallow: false, history: "push" },
  );

  const hasFilters = Boolean(filters.channel || filters.status || filters.businessId);

  // Base UI needs a value -> label map to render the trigger's text.
  const channelItems: Record<string, string> = { [ALL]: t("list.filters.all"), ...Object.fromEntries(MESSAGE_CHANNELS.map((c) => [c, tc(`channel.${c}`)])) };
  const statusItems: Record<string, string> = { [ALL]: t("list.filters.all"), ...Object.fromEntries(MESSAGE_STATUSES.map((x) => [x, t(`status.${x}`)])) };
  const businessItems: Record<string, string> = { [ALL]: t("list.filters.all"), ...Object.fromEntries(businesses.map((b) => [b.id, b.name])) };

  function update(patch: Partial<typeof filters>) {
    // Any filter change invalidates the current page offset.
    void setFilters({ ...patch, page: null });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-40 flex-col gap-1.5">
        <Label htmlFor="messages-filter-channel" className="text-xs text-muted-foreground">
          {t("list.filters.channel")}
        </Label>
        <Select
          items={channelItems}
          value={filters.channel ?? ALL}
          onValueChange={(value) => {
            if (typeof value === "string") update({ channel: value === ALL ? null : value });
          }}
        >
          <SelectTrigger id="messages-filter-channel" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("list.filters.all")}</SelectItem>
            {MESSAGE_CHANNELS.map((channel) => (
              <SelectItem key={channel} value={channel}>
                {tc(`channel.${channel}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-w-40 flex-col gap-1.5">
        <Label htmlFor="messages-filter-status" className="text-xs text-muted-foreground">
          {t("list.filters.status")}
        </Label>
        <Select
          items={statusItems}
          value={filters.status ?? ALL}
          onValueChange={(value) => {
            if (typeof value === "string") update({ status: value === ALL ? null : value });
          }}
        >
          <SelectTrigger id="messages-filter-status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("list.filters.all")}</SelectItem>
            {MESSAGE_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {t(`status.${status}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {businesses.length > 0 ? (
        <div className="flex min-w-56 flex-col gap-1.5">
          <Label htmlFor="messages-filter-business" className="text-xs text-muted-foreground">
            {t("list.filters.business")}
          </Label>
          <Select
            items={businessItems}
            value={filters.businessId ?? ALL}
            onValueChange={(value) => {
              if (typeof value === "string") update({ businessId: value === ALL ? null : value });
            }}
          >
            <SelectTrigger id="messages-filter-business" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("list.filters.all")}</SelectItem>
              {businesses.map((business) => (
                <SelectItem key={business.id} value={business.id}>
                  {business.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t("list.filters.businessHint")}</p>
        </div>
      ) : null}

      {hasFilters ? (
        <Button variant="ghost" size="sm" onClick={() => update({ channel: null, status: null, businessId: null })}>
          <FilterX />
          {t("list.filters.clear")}
        </Button>
      ) : null}
    </div>
  );
}
