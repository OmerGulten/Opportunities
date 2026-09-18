"use client";

import { useQueryState } from "nuqs";

import { PaginationControls } from "@/components/shared";

import { scanPageParser } from "./scan-filters";

export interface ScanPaginationProps {
  page: number;
  pageSize: number;
  total: number;
}

/** URL-driven pager for the scan list. */
export function ScanPagination({ page, pageSize, total }: ScanPaginationProps) {
  const [, setPage] = useQueryState("page", scanPageParser.withOptions({ shallow: false, history: "replace" }));
  if (total <= pageSize) return null;

  return (
    <PaginationControls
      page={page}
      pageSize={pageSize}
      total={total}
      onChange={(next) => {
        void setPage(next <= 1 ? null : next);
      }}
    />
  );
}
