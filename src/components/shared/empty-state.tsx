import { cn } from "cn";
import type { ReactNode } from "react";

import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Buttons or links offered instead of the missing content. */
  action?: ReactNode;
  /** Draw a dashed border around the state (default) or blend into the page. */
  bordered?: boolean;
  className?: string;
}

export function EmptyState({ icon, title, description, action, bordered = true, className }: EmptyStateProps) {
  return (
    <Empty className={cn(bordered && "border border-dashed", "py-10", className)}>
      <EmptyHeader>
        {icon ? (
          <EmptyMedia variant="icon" className="text-muted-foreground">
            {icon}
          </EmptyMedia>
        ) : null}
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {action ? <EmptyContent className="flex-row flex-wrap justify-center">{action}</EmptyContent> : null}
    </Empty>
  );
}
