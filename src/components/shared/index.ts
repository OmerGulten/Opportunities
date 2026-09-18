/**
 * Domain-neutral building blocks shared by every feature.
 * Feature modules import from "@/components/shared".
 */

export { GoogleAttribution, NotExhaustiveNotice } from "./attribution";
export type { GoogleAttributionProps, NotExhaustiveNoticeProps } from "./attribution";
export { ConfirmDialog } from "./confirm-dialog";
export type { ConfirmDialogProps } from "./confirm-dialog";
export { CopyButton } from "./copy-button";
export type { CopyButtonProps } from "./copy-button";
export { DataTable } from "./data-table";
export type { ColumnAlign, DataTableColumn, DataTableProps } from "./data-table";
export { DemoBadge } from "./demo-badge";
export type { DemoBadgeProps } from "./demo-badge";
export { EmptyState } from "./empty-state";
export type { EmptyStateProps } from "./empty-state";
export { ConfidenceBadge, EvidenceTypeBadge, SeverityBadge } from "./evidence-badges";
export type { ConfidenceBadgeProps, EvidenceTypeBadgeProps, SeverityBadgeProps } from "./evidence-badges";
export { InlineAlert } from "./inline-alert";
export type { InlineAlertProps } from "./inline-alert";
export { KeyValueList } from "./key-value-list";
export type { KeyValueItem, KeyValueListProps } from "./key-value-list";
export { LocaleSwitcher } from "./locale-switcher";
export type { LocaleSwitcherProps } from "./locale-switcher";
export { PageHeader } from "./page-header";
export type { Crumb, PageHeaderProps } from "./page-header";
export { PaginationControls } from "./pagination-controls";
export type { PaginationControlsProps } from "./pagination-controls";
export { ProgressSteps } from "./progress-steps";
export type { ProgressStep, ProgressStepsProps } from "./progress-steps";
export { ScoreBadge, ScoreBar, ScoreRing } from "./score";
export type { ScoreBadgeProps, ScoreBarProps, ScoreRingProps, ScoreSize } from "./score";
export { Section } from "./section";
export type { SectionProps } from "./section";
export { ServiceBadge, ServiceIcon } from "./service";
export type { ServiceBadgeProps, ServiceIconProps } from "./service";
export { Kpi, StatCard } from "./stat-card";
export type { KpiProps, StatCardProps } from "./stat-card";
export { StatusBadge, WebsiteStatusBadge } from "./status-badge";
export type { StatusBadgeProps, WebsiteStatusBadgeProps } from "./status-badge";
export { ThemeToggle } from "./theme-toggle";
export type { ThemeToggleProps } from "./theme-toggle";
export {
  clampScore,
  confidenceTone,
  evidenceTone,
  observationTone,
  scoreTier,
  scoreTierTone,
  severityTone,
  toneBadgeClass,
  toneFillClass,
  toneStrokeClass,
  toneTextClass,
  websiteStatusTone,
} from "./tokens";
export type { ScoreTier, Tone } from "./tokens";
