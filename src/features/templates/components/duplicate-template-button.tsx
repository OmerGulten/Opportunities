"use client";

import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { duplicateTemplateAction } from "@/features/templates/actions";
import { useT } from "@/lib/i18n/client";

export interface DuplicateTemplateButtonProps {
  templateId: string;
  scope?: "workspace" | "personal";
  label?: string;
}

/** Copies a read-only built-in template and opens the editable copy. */
export function DuplicateTemplateButton({ templateId, scope = "workspace", label }: DuplicateTemplateButtonProps) {
  const t = useT("templates");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    const result = await duplicateTemplateAction(templateId, scope);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(t("toast.duplicated"));
    router.push(`/templates/${result.data.id}`);
  }

  return (
    <Button type="button" onClick={handleClick} disabled={pending}>
      {pending ? <Spinner /> : <Copy />}
      {label ?? t("actions.duplicateToEdit")}
    </Button>
  );
}
