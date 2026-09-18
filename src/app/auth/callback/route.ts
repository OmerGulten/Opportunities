import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { authErrorKey } from "@/features/auth/error-map";
import { safeNextPath } from "@/features/auth/schemas";
import { isSupabaseConfigured } from "@/lib/config/env";
import { createLogger } from "@/lib/logging";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const log = createLogger({ scope: "auth.callback" });

const OTP_TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (OTP_TYPES as readonly string[]).includes(value);
}

/**
 * Completes an email link sign-in. Supports both the PKCE `?code=` flow and
 * the `?token_hash=&type=` verification flow, then continues to `?next=`
 * (same-origin paths only) or the dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const failure = (key: string) => NextResponse.redirect(new URL(`/sign-in?error=${key}`, origin));

  if (!isSupabaseConfigured()) return failure("callbackFailed");

  // Supabase forwards its own failures as query parameters.
  if (searchParams.get("error") || searchParams.get("error_code")) {
    const description = searchParams.get("error_description") ?? searchParams.get("error_code") ?? "";
    return failure(authErrorKey({ message: description }));
  }

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  try {
    const supabase = await createClient();

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        log.warn("exchange_failed", { code: error.code });
        return failure(authErrorKey(error));
      }
    } else if (tokenHash && isEmailOtpType(type)) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (error) {
        log.warn("verify_failed", { code: error.code });
        return failure(authErrorKey(error));
      }
    } else {
      return failure("callbackFailed");
    }
  } catch (error) {
    log.error("callback_error", { error: error instanceof Error ? error.message : String(error) });
    return failure("callbackFailed");
  }

  return NextResponse.redirect(new URL(next, origin));
}
