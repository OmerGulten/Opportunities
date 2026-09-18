"use client";

import { cn } from "cn";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n/client";

export interface PaginationControlsProps {
  /** 1-based page number. */
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  /** Offer a page-size selector when provided together with onPageSizeChange. */
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
}

export function PaginationControls({ page, pageSize, total, onChange, pageSizeOptions, onPageSizeChange, className }: PaginationControlsProps) {
  const t = useT("common");
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const current = Math.min(Math.max(1, page), pageCount);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(total, current * pageSize);
  const showSizes = Boolean(pageSizeOptions && pageSizeOptions.length > 0 && onPageSizeChange);

  return (
    <div className={cn("flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between", className)}>
      <p className="text-muted-foreground tabular-nums">{t("pagination.showing", { from, to, total })}</p>
      <div className="flex items-center gap-3">
        {showSizes ? (
          <label className="flex items-center gap-2 text-muted-foreground">
            <span className="hidden sm:inline">{t("pagination.perPage")}</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                if (typeof value === "string") onPageSizeChange?.(Number(value));
              }}
            >
              <SelectTrigger size="sm" className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions?.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        ) : null}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" aria-label={t("pagination.first")} disabled={current <= 1} onClick={() => onChange(1)}>
            <ChevronsLeft />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label={t("pagination.previous")} disabled={current <= 1} onClick={() => onChange(current - 1)}>
            <ChevronLeft />
          </Button>
          <span className="px-2 text-muted-foreground tabular-nums">{t("pagination.page", { page: `${current} / ${pageCount}` })}</span>
          <Button variant="outline" size="icon-sm" aria-label={t("pagination.next")} disabled={current >= pageCount} onClick={() => onChange(current + 1)}>
            <ChevronRight />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label={t("pagination.last")} disabled={current >= pageCount} onClick={() => onChange(pageCount)}>
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
