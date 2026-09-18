"use client";

import { CircleAlert, House, RotateCcw } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

/** Root error boundary (public pages and anything outside the app shell). */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT("errors");
  const tn = useT("nav");

  return (
    <main className="flex min-h-svh flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <Logo size={40} className="text-muted-foreground" />
      <span className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
        <CircleAlert className="size-5" />
      </span>
      <div className="max-w-md space-y-1">
        <h1 className="font-heading text-xl font-semibold">{t("generic")}</h1>
        <p className="text-sm text-muted-foreground">{t("internal_error")}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcw />
          {t("tryAgain")}
        </Button>
        <Button variant="outline" render={<Link href="/" />}>
          <House />
          {tn("home")}
        </Button>
      </div>
      {error.digest ? <p className="font-mono text-xs text-muted-foreground">{error.digest}</p> : null}
    </main>
  );
}
