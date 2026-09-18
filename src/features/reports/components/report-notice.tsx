import { LinkIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Logo } from "@/components/app/logo";

export interface ReportNoticeProps {
  title: string;
  description: string;
  /** Defaults to a neutral link glyph; a report that does not exist gets no branding. */
  icon?: ReactNode;
  children?: ReactNode;
}

/**
 * Stand-in shown instead of a report: the link is unknown, revoked or expired.
 *
 * It deliberately reveals nothing about whether a report ever existed at this
 * token beyond what the visitor already knows, and carries no workspace
 * branding, no business name and no findings.
 */
export function ReportNotice({ title, description, icon, children }: ReportNoticeProps) {
  return (
    <main className="flex min-h-svh flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <Logo size={40} className="text-muted-foreground" />
      <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        {icon ?? <LinkIcon className="size-5" aria-hidden />}
      </span>
      <div className="max-w-md space-y-2">
        <h1 className="font-heading text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-pretty text-muted-foreground">{description}</p>
      </div>
      {children}
    </main>
  );
}
