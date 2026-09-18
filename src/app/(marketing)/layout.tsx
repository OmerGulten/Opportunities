import type { ReactNode } from "react";

import { CookieConsent } from "@/components/app/cookie-consent";
import { MarketingFooter } from "@/components/app/marketing-footer";
import { MarketingHeader } from "@/components/app/marketing-header";
import { getAuthContext } from "@/lib/auth/context";
import { isSupabaseConfigured } from "@/lib/config/env";

export const dynamic = "force-dynamic";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const auth = isSupabaseConfigured() ? await getAuthContext().catch(() => null) : null;

  return (
    <div className="flex min-h-svh flex-1 flex-col">
      <MarketingHeader isAuthenticated={Boolean(auth)} />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
      <CookieConsent />
    </div>
  );
}
