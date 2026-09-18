"use client";

import { CircleAlert, RotateCcw } from "lucide-react";

import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

/**
 * Error boundary for the public report. The visitor is anonymous, so there is
 * no app to send them back to and nothing about the report is disclosed.
 */
export default function PublicReportError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT("reports");

  return (
    <main className="flex min-h-svh flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <Logo size={40} className="text-muted-foreground" />
      <span className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
        <CircleAlert className="size-5" aria-hidden />
      </span>
      <div className="max-w-md space-y-2">
        <h1 className="font-heading text-xl font-semibold tracking-tight">{t("public.states.errorTitle")}</h1>
        <p className="text-sm text-pretty text-muted-foreground">{t("public.states.errorDescription")}</p>
      </div>
      <Button onClick={reset}>
        <RotateCcw />
        {t("public.states.retry")}
      </Button>
      {error.digest ? <p className="font-mono text-xs text-muted-foreground">{error.digest}</p> : null}
    </main>
  );
}
