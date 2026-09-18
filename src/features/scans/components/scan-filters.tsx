"use client";

import { parseAsInteger, parseAsStringLiteral, useQueryState } from "nuqs";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n/client";

import { SCAN_STATUS_FILTERS, isScanStatusFilter, type ScanStatusFilter } from "./scan-filter-options";

export const scanStatusParser = parseAsStringLiteral(SCAN_STATUS_FILTERS).withDefault("all");
export const scanPageParser = parseAsInteger.withDefault(1);

/**
 * Status filter for the scan list. The value lives in the URL so a filtered
 * list can be shared and survives navigating into a scan and back.
 */
export function ScanFilters() {
  const t = useT("scans");
  const [status, setStatus] = useQueryState("status", scanStatusParser.withOptions({ shallow: false, history: "replace" }));
  const [, setPage] = useQueryState("page", scanPageParser.withOptions({ shallow: false, history: "replace" }));

  function update(next: ScanStatusFilter) {
    void setStatus(next === "all" ? null : next);
    void setPage(null);
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="scan-status-filter" className="text-xs text-muted-foreground">
          {t("list.filterStatus")}
        </Label>
        <Select
          value={status}
          onValueChange={(value) => {
            if (isScanStatusFilter(value)) update(value);
          }}
        >
          <SelectTrigger id="scan-status-filter" size="sm" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCAN_STATUS_FILTERS.map((option) => (
              <SelectItem key={option} value={option}>
                {t(`list.statusFilters.${option}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {status !== "all" ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => update("all")}>
          {t("list.clearFilters")}
        </Button>
      ) : null}
    </div>
  );
}
