"use client";

import { CircleAlert, LayoutDashboard, RotateCcw } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

/**
 * Admin segment error boundary. Server errors reach the client already
 * sanitized, so only a localized sentence and the support digest are shown.
 */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT("errors");
  const ta = useT("admin");

  return (
    <div className="flex min-h-[50vh] flex-1 items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <CircleAlert className="size-5" />
        </span>
        <div className="space-y-1">
          <h1 className="font-heading text-lg font-semibold">{t("generic")}</h1>
          <p className="text-sm text-muted-foreground">{ta("common.loadFailed")}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={reset}>
            <RotateCcw />
            {t("tryAgain")}
          </Button>
          <Button variant="outline" render={<Link href="/admin" />}>
            <LayoutDashboard />
            {ta("overview.title")}
          </Button>
        </div>
        {error.digest ? <p className="font-mono text-xs text-muted-foreground">{error.digest}</p> : null}
      </div>
    </div>
  );
}
