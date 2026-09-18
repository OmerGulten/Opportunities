import { cn } from "cn";
import type { ReactNode } from "react";

export interface SectionProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Anchor id, used by in-page navigation on long pages. */
  id?: string;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
}

/** Titled content block with consistent spacing across the app. */
export function Section({ title, description, actions, id, children, className, headerClassName }: SectionProps) {
  return (
    <section id={id} className={cn("flex scroll-mt-20 flex-col gap-3", className)}>
      {title || description || actions ? (
        <div className={cn("flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between", headerClassName)}>
          <div className="min-w-0 space-y-0.5">
            {title ? <h2 className="font-heading text-base leading-snug font-medium">{title}</h2> : null}
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
