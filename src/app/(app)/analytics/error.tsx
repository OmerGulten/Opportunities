"use client";

import { ChartColumn, RotateCcw } from "lucide-react";

import { EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

/**
 * Analytics segment error boundary. Server errors arrive sanitized, so the user
 * sees a localized sentence plus the support digest — never a stack trace.
 */
export default function AnalyticsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT("errors");
  const ta = useT("analytics");

  return (
    <div className="flex flex-col gap-4">
      <EmptyState
        icon={<ChartColumn />}
        title={ta("title")}
        description={t("internal_error")}
        action={
          <Button onClick={reset}>
            <RotateCcw />
            {t("tryAgain")}
          </Button>
        }
      />
      {error.digest ? <p className="text-center font-mono text-xs text-muted-foreground">{error.digest}</p> : null}
    </div>
  );
}
