"use client";

import { RotateCcw, Settings } from "lucide-react";

import { EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

/**
 * Settings segment error boundary. Server errors reach the client sanitized, so
 * this shows a localized sentence and the support digest, never a stack trace.
 */
export default function SettingsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT("errors");
  const ts = useT("settings");

  return (
    <div className="flex flex-col gap-4">
      <EmptyState
        icon={<Settings />}
        title={ts("errors.loadFailed")}
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
