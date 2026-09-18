/**
 * Reads the `{ error: { code, message } }` envelope every route handler returns
 * through `withApi()`. The code is what the UI localizes; the server message is
 * never shown raw.
 */
export async function readErrorCode(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { code?: string } };
    return body.error?.code ?? "generic";
  } catch {
    return "generic";
  }
}
