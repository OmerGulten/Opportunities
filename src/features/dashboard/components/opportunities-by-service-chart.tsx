"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

export interface ServiceOpportunityPoint {
  /** Already localized service name. */
  label: string;
  count: number;
  averageScore: number | null;
}

/**
 * Businesses whose primary opportunity is each service.
 *
 * A count of what was observed, not a forecast: the bar height is the number of
 * businesses currently scored into that service.
 */
export function OpportunitiesByServiceChart({ data, countLabel }: { data: ServiceOpportunityPoint[]; countLabel: string }) {
  const config = { count: { label: countLabel, color: "var(--chart-1)" } } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart accessibilityLayer data={data} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tickMargin={6} />
        <YAxis type="category" dataKey="label" width={132} tickLine={false} axisLine={false} tickMargin={6} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={[0, 6, 6, 0]} maxBarSize={22} />
      </BarChart>
    </ChartContainer>
  );
}
