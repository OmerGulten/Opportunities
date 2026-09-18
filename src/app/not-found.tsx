import { House, Radar } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { getRequestLocale } from "@/lib/auth/context";
import { getT } from "@/lib/i18n";

export default async function NotFound() {
  const locale = await getRequestLocale();
  const t = getT(locale, "errors");
  const tn = getT(locale, "nav");

  return (
    <main className="flex min-h-svh flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <Logo size={44} className="text-muted-foreground" />
      <div className="max-w-md space-y-2">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="font-heading text-xl font-semibold">{t("notFoundTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("notFoundDescription")}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button render={<Link href="/" />}>
          <House />
          {tn("home")}
        </Button>
        <Button variant="outline" render={<Link href="/dashboard" />}>
          <Radar />
          {t("goHome")}
        </Button>
      </div>
    </main>
  );
}
