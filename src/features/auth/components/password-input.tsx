"use client";

import { cn } from "cn";
import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/client";

export type PasswordInputProps = Omit<ComponentProps<typeof Input>, "type">;

/** Password field with a visibility toggle that keeps the value in the DOM. */
export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const t = useT("auth");
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pr-9", className)} />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="absolute inset-y-0 right-1 my-auto text-muted-foreground"
        aria-label={visible ? t("fields.hidePassword") : t("fields.showPassword")}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  );
}
