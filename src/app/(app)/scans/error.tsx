"use client";

import { CircleAlert, List, RotateCcw } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

/**
 * Error boundary for the scans segment. Server errors arrive sanitized, so the
 * user gets a localized sentence plus the support digest, never a stack trace.
 */
export default function ScansError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT("scans");
  const te = useT("errors");

  return (
    <div className="flex min-h-[50vh] flex-1 items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <CircleAlert className="size-5" />
        </span>
        <div className="space-y-1">
          <h1 className="font-heading text-lg font-semibold">{t("error.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("error.description")}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={reset}>
            <RotateCcw />
            {te("tryAgain")}
          </Button>
          <Button variant="outline" render={<Link href="/scans" />}>
            <List />
            {t("error.backToList")}
          </Button>
        </div>
        {error.digest ? <p className="font-mono text-xs text-muted-foreground">{error.digest}</p> : null}
      </div>
    </div>
  );
}
