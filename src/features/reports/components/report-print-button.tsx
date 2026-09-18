"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

/** Opens the browser print dialog; the page carries its own @media print rules. */
export function ReportPrintButton() {
  const t = useT("reports");
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      <Printer />
      {t("public.print")}
    </Button>
  );
}
