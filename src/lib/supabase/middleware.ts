import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publishableKey } from "@/lib/config/env";

/** Paths that require an authenticated session. */
const PROTECTED_PREFIXES = ["/dashboard", "/scans", "/opportunities", "/businesses", "/pipeline", "/messages", "/templates", "/analytics", "/settings", "/onboarding", "/admin"];
/** Auth pages: redirect to the app when already signed in. */
const AUTH_PREFIXES = ["/sign-in", "/sign-up"];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isAuthPath(pathname: string): boolean {
  return AUTH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refreshes the Supabase session cookie and enforces auth redirects.
 * Called from src/proxy.ts on every matched request.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = publishableKey();
  if (!url || !key) {
    // Supabase not configured: let pages render their own "not configured" notice.
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  // IMPORTANT: do not run code between createServerClient and getClaims().
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  if (!isAuthenticated && isProtectedPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/sign-in";
    redirectUrl.searchParams.set("next", pathname + (request.nextUrl.search || ""));
    const redirect = NextResponse.redirect(redirectUrl);
    supabaseResponse.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  if (isAuthenticated && isAuthPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    const redirect = NextResponse.redirect(redirectUrl);
    supabaseResponse.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return supabaseResponse;
}
