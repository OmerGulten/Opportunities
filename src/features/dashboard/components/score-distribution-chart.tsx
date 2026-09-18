"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

export interface ScoreBucketPoint {
  bucket: string;
  min: number;
  max: number;
  count: number;
}

/**
 * Score tiers follow docs/conventions.md: >= 70 emerald, 40-69 amber, < 40 slate.
 * Utility classes rather than inline fills, so the bars follow the theme and the
 * colours stay in Tailwind's token space.
 */
function barClass(min: number): string {
  if (min >= 70) return "fill-emerald-500";
  if (min >= 40) return "fill-amber-500";
  return "fill-slate-400 dark:fill-slate-500";
}

/** How many businesses sit in each overall-score band. */
export function ScoreDistributionChart({ data, countLabel }: { data: ScoreBucketPoint[]; countLabel: string }) {
  const config = { count: { label: countLabel, color: "var(--chart-1)" } } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart accessibilityLayer data={data} margin={{ left: 4, right: 8, top: 4, bottom: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={6} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} tickMargin={4} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={56}>
          {data.map((point) => (
            <Cell key={point.bucket} className={barClass(point.min)} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
