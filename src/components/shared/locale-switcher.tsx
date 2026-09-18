"use client";

import { cn } from "cn";
import { Check, Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLocalePreference } from "@/hooks/use-locale-preference";
import { LOCALE_LABELS } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";
import { LOCALES } from "@/types/common";

export interface LocaleSwitcherProps {
  /** `icon` is a compact icon button; `inline` also shows the active language. */
  variant?: "icon" | "inline";
  className?: string;
}

export function LocaleSwitcher({ variant = "icon", className }: LocaleSwitcherProps) {
  const t = useT("nav");
  const { locale, setLocale, pending } = useLocalePreference();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size={variant === "icon" ? "icon-sm" : "sm"} className={cn(className)} aria-label={t("language")} disabled={pending} />
        }
      >
        <Languages />
        {variant === "inline" ? <span>{LOCALE_LABELS[locale]}</span> : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {LOCALES.map((option) => (
          <DropdownMenuItem key={option} onClick={() => setLocale(option)}>
            <span className="flex-1">{LOCALE_LABELS[option]}</span>
            {option === locale ? <Check className="size-3.5" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
