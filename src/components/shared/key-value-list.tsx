import { cn } from "cn";
import type { ReactNode } from "react";

export interface KeyValueItem {
  /** Stable key for React; also used as the row anchor. */
  key: string;
  label: ReactNode;
  value: ReactNode;
  /** Optional muted note under the value (for example the evidence source). */
  hint?: ReactNode;
}

export interface KeyValueListProps {
  items: KeyValueItem[];
  /** `row` puts label and value side by side; `stacked` keeps them in a column. */
  variant?: "row" | "stacked";
  /** Hairline separators between entries. */
  divided?: boolean;
  className?: string;
}

export function KeyValueList({ items, variant = "row", divided = true, className }: KeyValueListProps) {
  return (
    <dl className={cn("w-full text-sm", divided && "divide-y divide-border", className)}>
      {items.map((item) => (
        <div
          key={item.key}
          className={cn(
            "gap-1 py-2 first:pt-0 last:pb-0",
            variant === "row" ? "flex flex-col sm:flex-row sm:items-baseline sm:gap-4" : "flex flex-col",
          )}
        >
          <dt className={cn("text-muted-foreground", variant === "row" && "sm:w-48 sm:shrink-0")}>{item.label}</dt>
          <dd className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">{item.value}</div>
            {item.hint ? <p className="mt-0.5 text-xs text-muted-foreground">{item.hint}</p> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
