import { Radar } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export interface RecentScanItem {
  id: string;
  name: string;
  statusLabel: string;
  /** Terminal scans are done; active ones keep their progress bar. */
  active: boolean;
  percent: number;
  businessesLabel: string;
  createdLabel: string | null;
  isDemo: boolean;
}

export interface RecentScansProps {
  items: RecentScanItem[];
  labels: {
    empty: string;
    open: string;
    demo: string;
  };
}

/** The workspace's latest scans with their lifecycle status and progress. */
export function RecentScans({ items, labels }: RecentScansProps) {
  if (items.length === 0) {
    return <EmptyState icon={<Radar />} title={labels.empty} />;
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((scan) => (
        <li key={scan.id}>
          <Link
            href={`/scans/${scan.id}`}
            aria-label={labels.open}
            className="flex flex-col gap-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{scan.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {scan.businessesLabel}
                  {scan.createdLabel ? ` · ${scan.createdLabel}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {scan.isDemo ? (
                  <Badge variant="outline" className="border-amber-600/25 bg-amber-500/14 font-normal text-amber-700 dark:border-amber-400/25 dark:text-amber-300">
                    {labels.demo}
                  </Badge>
                ) : null}
                <Badge variant="outline" className="font-normal">
                  {scan.statusLabel}
                </Badge>
              </div>
            </div>
            {scan.active ? <Progress value={scan.percent} aria-label={scan.statusLabel} /> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
