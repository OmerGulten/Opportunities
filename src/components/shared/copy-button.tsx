"use client";

import { cn } from "cn";
import { Check, Copy } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

export interface CopyButtonProps {
  value: string;
  /** Show the label next to the icon instead of an icon-only button. */
  withLabel?: boolean;
  label?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  className?: string;
}

export function CopyButton({ value, withLabel = false, label, variant = "ghost", size, className }: CopyButtonProps) {
  const t = useT("common");
  const [copied, setCopied] = useState(false);
  const text = label ?? t("actions.copy");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(t("actions.copied"));
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(t("states.error"));
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size ?? (withLabel ? "sm" : "icon-sm")}
      className={cn(className)}
      onClick={handleCopy}
      aria-label={withLabel ? undefined : text}
    >
      {copied ? <Check className="text-emerald-600 dark:text-emerald-400" /> : <Copy />}
      {withLabel ? <span>{copied ? t("actions.copied") : text}</span> : null}
    </Button>
  );
}
