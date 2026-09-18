"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { errorMessage } from "@/features/businesses/components/api-client";
import { useT } from "@/lib/i18n/client";

/**
 * Runs one API-route mutation from a list row or from the business profile.
 *
 * Success is reported with the caller's localized sentence; failures are mapped
 * from the server's error *code* through the `errors` namespace, so no raw
 * provider or database message is ever shown. `revalidate` is the feature's
 * server action, which re-renders the affected Server Components.
 */
export interface RowMutation {
  pending: boolean;
  run: (operation: () => Promise<void>, successMessage: string, revalidate: () => Promise<unknown>) => Promise<boolean>;
}

export function useRowMutation(): RowMutation {
  const te = useT("errors");
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async (operation: () => Promise<void>, successMessage: string, revalidate: () => Promise<unknown>) => {
      setPending(true);
      try {
        await operation();
        toast.success(successMessage);
        await revalidate();
        return true;
      } catch (error) {
        toast.error(errorMessage(error, te));
        return false;
      } finally {
        setPending(false);
      }
    },
    [te],
  );

  return { pending, run };
}
