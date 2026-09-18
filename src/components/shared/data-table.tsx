"use client";

import { cn } from "cn";
import { useState, type ReactNode } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useT } from "@/lib/i18n/client";

export type ColumnAlign = "start" | "center" | "end";

export interface DataTableColumn<Row> {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  className?: string;
  align?: ColumnAlign;
}

export interface DataTableProps<Row> {
  columns: Array<DataTableColumn<Row>>;
  rows: Row[];
  /** Stable identity for a row; also the value used by selection. */
  rowKey: (row: Row) => string;
  /** Rendered instead of the body when there are no rows and loading is false. */
  emptyState?: ReactNode;
  loading?: boolean;
  skeletonRows?: number;
  /** Show a leading checkbox column. */
  selectable?: boolean;
  /** Controlled selection; omit to let the table manage it internally. */
  selectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  onRowClick?: (row: Row) => void;
  caption?: ReactNode;
  className?: string;
}

const alignClass: Record<ColumnAlign, string> = {
  start: "text-left",
  center: "text-center",
  end: "text-right",
};

/**
 * Presentational table. It owns no data fetching, sorting or filtering: the
 * feature module passes already-prepared rows and cell renderers.
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  emptyState,
  loading = false,
  skeletonRows = 5,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  onRowClick,
  caption,
  className,
}: DataTableProps<Row>) {
  const t = useT("common");
  const [internalSelection, setInternalSelection] = useState<string[]>([]);
  const selection = selectedKeys ?? internalSelection;
  const selectedSet = new Set(selection);
  const totalColumns = columns.length + (selectable ? 1 : 0);

  function commitSelection(next: string[]) {
    if (selectedKeys === undefined) setInternalSelection(next);
    onSelectionChange?.(next);
  }

  function toggleRow(key: string, checked: boolean) {
    const next = checked ? [...selection.filter((k) => k !== key), key] : selection.filter((k) => k !== key);
    commitSelection(next);
  }

  function toggleAll(checked: boolean) {
    commitSelection(checked ? rows.map(rowKey) : []);
  }

  const allSelected = rows.length > 0 && rows.every((row) => selectedSet.has(rowKey(row)));

  return (
    <div className={cn("w-full overflow-hidden rounded-xl ring-1 ring-foreground/10", className)}>
      <Table>
        {caption ? <TableCaption>{caption}</TableCaption> : null}
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            {selectable ? (
              <TableHead className="w-10 pl-3">
                <Checkbox checked={allSelected} onCheckedChange={(checked) => toggleAll(checked === true)} aria-label={t("table.selectAll")} />
              </TableHead>
            ) : null}
            {columns.map((column) => (
              <TableHead key={column.key} className={cn(alignClass[column.align ?? "start"], column.className)}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: skeletonRows }, (_, index) => (
              <TableRow key={`skeleton-${index}`} className="hover:bg-transparent">
                {Array.from({ length: totalColumns }, (__, cellIndex) => (
                  <TableCell key={`skeleton-cell-${cellIndex}`}>
                    <Skeleton className="h-4 w-full max-w-40" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={totalColumns} className="p-0">
                {emptyState ?? <p className="p-6 text-center text-sm text-muted-foreground">{t("states.noResults")}</p>}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const key = rowKey(row);
              const isSelected = selectedSet.has(key);
              return (
                <TableRow
                  key={key}
                  data-state={isSelected ? "selected" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cn(onRowClick && "cursor-pointer focus-visible:bg-muted/60 focus-visible:outline-none")}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                >
                  {selectable ? (
                    <TableCell className="w-10 pl-3">
                      <span
                        className="inline-flex"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        role="presentation"
                      >
                        <Checkbox checked={isSelected} onCheckedChange={(checked) => toggleRow(key, checked === true)} aria-label={t("table.selectRow")} />
                      </span>
                    </TableCell>
                  ) : null}
                  {columns.map((column) => (
                    <TableCell key={column.key} className={cn(alignClass[column.align ?? "start"], column.className)}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
