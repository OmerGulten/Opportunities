"use client";

import { useState, type ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/lib/i18n/client";

export interface ConfirmDialogProps {
  title: ReactNode;
  description?: ReactNode;
  /** Element that opens the dialog; omit when controlling `open` yourself. */
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Awaited; the dialog shows a pending state and closes on success. */
  onConfirm: () => void | Promise<void>;
  /** Style the confirm action as a destructive step. */
  destructive?: boolean;
  children?: ReactNode;
}

/**
 * AlertDialog wrapper with an async confirm action. The dialog stays open when
 * `onConfirm` rejects so the caller can surface the error next to it.
 */
export function ConfirmDialog({
  title,
  description,
  trigger,
  open,
  onOpenChange,
  confirmLabel,
  cancelLabel,
  onConfirm,
  destructive = false,
  children,
}: ConfirmDialogProps) {
  const t = useT("common");
  const [internalOpen, setInternalOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const isOpen = open ?? internalOpen;

  function setOpen(next: boolean) {
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  }

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm();
      setOpen(false);
    } catch {
      // Keep the dialog open; the caller reports the failure.
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={(next) => setOpen(next)}>
      {trigger ? <AlertDialogTrigger render={<span className="contents" />}>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel ?? t("actions.cancel")}</AlertDialogCancel>
          <AlertDialogAction variant={destructive ? "destructive" : "default"} disabled={pending} onClick={handleConfirm}>
            {pending ? <Spinner /> : null}
            {confirmLabel ?? t("actions.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
