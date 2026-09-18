export interface PipelineStagePoint {
  key: string;
  name: string;
  count: number;
}

/**
 * Leads per stage as proportional bars.
 *
 * It is a picture of where the leads currently sit — not a conversion forecast,
 * so no rate, probability or projected value is shown.
 */
export function PipelineFunnel({ stages, emptyLabel, countLabel }: { stages: PipelineStagePoint[]; emptyLabel: string; countLabel: (count: number) => string }) {
  const total = stages.reduce((sum, stage) => sum + stage.count, 0);

  if (total === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  const max = Math.max(...stages.map((stage) => stage.count), 1);

  return (
    <ul className="flex flex-col gap-2.5">
      {stages.map((stage) => (
        <li key={stage.key} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 truncate text-muted-foreground">{stage.name}</span>
          <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted" role="meter" aria-valuenow={stage.count} aria-valuemin={0} aria-valuemax={max} aria-label={stage.name}>
            <span className="block h-full rounded-full bg-chart-1" style={{ width: `${Math.max(2, Math.round((stage.count / max) * 100))}%` }} />
          </span>
          <span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{countLabel(stage.count)}</span>
        </li>
      ))}
    </ul>
  );
}
