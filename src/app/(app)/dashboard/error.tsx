"use client";

import { CircleAlert, RotateCcw, SquarePlus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

/** Dashboard segment error boundary: localized, code-free, retryable. */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT("errors");
  const td = useT("dashboard");

  return (
    <div className="flex min-h-[50vh] flex-1 items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <CircleAlert className="size-5" />
        </span>
        <div className="space-y-1">
          <h1 className="font-heading text-lg font-semibold">{td("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("generic")}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={reset}>
            <RotateCcw />
            {t("tryAgain")}
          </Button>
          <Button variant="outline" render={<Link href="/scans/new" />}>
            <SquarePlus />
            {td("newScan")}
          </Button>
        </div>
        {error.digest ? <p className="font-mono text-xs text-muted-foreground">{error.digest}</p> : null}
      </div>
    </div>
  );
}
