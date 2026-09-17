import { logger } from "@/lib/logging";
import type { Json } from "@/types/common";

/**
 * Observability for every external call. Persisted to provider_call_logs by
 * the caller-supplied sink (admin client in server code); always logged.
 * Never include secrets or full bodies in `requestContext`.
 */
export interface ProviderCallRecord {
  providerName: string;
  operation: string;
  durationMs: number;
  success: boolean;
  errorCode?: string | null;
  estimatedCost: number;
  requestContext: Record<string, Json>;
  workspaceId?: string | null;
  scanId?: string | null;
}

export type ProviderCallSink = (record: ProviderCallRecord) => Promise<void> | void;

let sink: ProviderCallSink | null = null;
const pending: ProviderCallRecord[] = [];

export function setProviderCallSink(s: ProviderCallSink | null) {
  sink = s;
}

export async function recordProviderCall(record: ProviderCallRecord): Promise<void> {
  logger.info("provider_call", {
    provider: record.providerName,
    operation: record.operation,
    durationMs: record.durationMs,
    success: record.success,
    errorCode: record.errorCode ?? undefined,
    estimatedCost: record.estimatedCost,
    workspaceId: record.workspaceId ?? undefined,
    scanId: record.scanId ?? undefined,
  });
  if (sink) {
    try {
      await sink(record);
    } catch (err) {
      logger.warn("provider_call_sink_failed", { error: err instanceof Error ? err.message : String(err) });
    }
  } else {
    pending.push(record);
    if (pending.length > 500) pending.shift();
  }
}

/** Test/inspection helper. */
export function drainPendingProviderCalls(): ProviderCallRecord[] {
  return pending.splice(0, pending.length);
}

/** Wrap an external call with timing + logging. */
export async function timedProviderCall<T>(
  meta: Omit<ProviderCallRecord, "durationMs" | "success" | "errorCode">,
  fn: () => Promise<T>,
  errorCodeOf: (err: unknown) => string = (err) => (err as { code?: string })?.code ?? "error",
): Promise<T> {
  const started = Date.now();
  try {
    const result = await fn();
    await recordProviderCall({ ...meta, durationMs: Date.now() - started, success: true, errorCode: null });
    return result;
  } catch (err) {
    await recordProviderCall({ ...meta, durationMs: Date.now() - started, success: false, errorCode: errorCodeOf(err) });
    throw err;
  }
}
