"use client";

import { ChartColumnBig } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { EmptyState } from "@/components/shared";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useFormatters, useT } from "@/lib/i18n/client";

/**
 * Charts for the analytics page.
 *
 * Every series here is a count of something that was observed or of something
 * the user did. Nothing is projected forward, so there are no trend lines,
 * targets or predicted values anywhere in this file.
 */

const CHART_HEIGHT = "aspect-auto h-64 w-full";

/** Stable palette: a series keeps the same hue across the page. */
const SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

/** Matches the score tiers used by ScoreBadge / ScoreRing (>=70, 40-69, <40). */
function scoreTierColor(min: number): string {
  if (min >= 70) return "var(--chart-1)";
  if (min >= 40) return "var(--chart-4)";
  return "var(--muted-foreground)";
}

function ChartEmpty({ message }: { message: string }) {
  return <EmptyState bordered={false} icon={<ChartColumnBig />} title={message} className="py-8" />;
}

export interface FunnelDatum {
  key: string;
  label: string;
  value: number;
}

/** Discovered -> audited -> scored -> failed, as plain counts. */
export function DiscoveryFunnelChart({ data }: { data: FunnelDatum[] }) {
  const t = useT("analytics");
  const { number } = useFormatters();
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const config = { value: { label: t("chart.count"), color: "var(--chart-1)" } } satisfies ChartConfig;

  if (total === 0) return <ChartEmpty message={t("discovery.empty")} />;

  return (
    <ChartContainer config={config} className={CHART_HEIGHT}>
      <BarChart accessibilityLayer data={data} layout="vertical" margin={{ left: 4, right: 32, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={104} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel formatter={(value) => number(Number(value))} />} />
        <Bar dataKey="value" radius={6}>
          {data.map((item, index) => (
            <Cell key={item.key} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export interface ServiceDatum {
  key: string;
  label: string;
  count: number;
  averageScore: number | null;
}

/** Primary opportunities per service. */
export function ServiceOpportunityChart({ data }: { data: ServiceDatum[] }) {
  const t = useT("analytics");
  const { number } = useFormatters();
  const rows = data.filter((item) => item.count > 0);

  const config = { count: { label: t("chart.count"), color: "var(--chart-1)" } } satisfies ChartConfig;

  if (rows.length === 0) return <ChartEmpty message={t("opportunities.byServiceEmpty")} />;

  return (
    <ChartContainer config={config} className={CHART_HEIGHT}>
      <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ left: 4, right: 32, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={140} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel formatter={(value) => number(Number(value))} />} />
        <Bar dataKey="count" radius={6}>
          {rows.map((item, index) => (
            <Cell key={item.key} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export interface ScoreBucketDatum {
  bucket: string;
  min: number;
  count: number;
}

/** How scored businesses fall across score buckets. */
export function ScoreDistributionChart({ data }: { data: ScoreBucketDatum[] }) {
  const t = useT("analytics");
  const { number } = useFormatters();
  const total = data.reduce((sum, item) => sum + item.count, 0);

  const config = { count: { label: t("chart.count"), color: "var(--chart-1)" } } satisfies ChartConfig;

  if (total === 0) return <ChartEmpty message={t("opportunities.distributionEmpty")} />;

  return (
    <ChartContainer config={config} className={CHART_HEIGHT}>
      <BarChart accessibilityLayer data={data} margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis width={40} tickLine={false} axisLine={false} allowDecimals={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(value) => number(Number(value))} />} />
        <Bar dataKey="count" radius={6}>
          {data.map((item) => (
            <Cell key={item.bucket} fill={scoreTierColor(item.min)} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export interface GapDatum {
  key: string;
  label: string;
  count: number;
}

/** The gaps observed most often in the range. */
export function GapBreakdownChart({ data }: { data: GapDatum[] }) {
  const t = useT("analytics");
  const { number } = useFormatters();

  const config = { count: { label: t("chart.count"), color: "var(--chart-4)" } } satisfies ChartConfig;

  if (data.length === 0) return <ChartEmpty message={t("gaps.empty")} />;

  return (
    <ChartContainer config={config} className="aspect-auto h-72 w-full">
      <BarChart accessibilityLayer data={data} layout="vertical" margin={{ left: 4, right: 32, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={168} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel formatter={(value) => number(Number(value))} />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={6} />
      </BarChart>
    </ChartContainer>
  );
}

export interface CreditDayDatum {
  date: string;
  consumed: number;
}

/** Credits consumed per day, straight from the ledger. */
export function CreditUsageChart({ data }: { data: CreditDayDatum[] }) {
  const t = useT("analytics");
  const { number, date: formatDate } = useFormatters();

  const config = { consumed: { label: t("credits.chartLabel"), color: "var(--chart-1)" } } satisfies ChartConfig;

  if (data.length === 0) return <ChartEmpty message={t("credits.byDayEmpty")} />;

  return (
    <ChartContainer config={config} className={CHART_HEIGHT}>
      <AreaChart accessibilityLayer data={data} margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(value: string) => formatDate(value, { day: "2-digit", month: "short" })}
        />
        <YAxis width={40} tickLine={false} axisLine={false} allowDecimals={false} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_label, payload) => {
                const raw = payload?.[0]?.payload as CreditDayDatum | undefined;
                return raw ? formatDate(raw.date) : "";
              }}
              formatter={(value) => number(Number(value))}
            />
          }
        />
        <Area dataKey="consumed" type="monotone" stroke="var(--color-consumed)" fill="var(--color-consumed)" fillOpacity={0.18} strokeWidth={2} />
      </AreaChart>
    </ChartContainer>
  );
}
