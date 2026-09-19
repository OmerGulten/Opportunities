import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "places.googleapis.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  serverExternalPackages: ["cheerio"],

  /**
   * Response hardening.
   *
   * Deliberately no Content-Security-Policy here. A correct one for this app
   * has to admit Google Maps' own script and worker loading, Supabase's REST
   * and realtime origins, and Next's inline bootstrap, and a CSP that is wrong
   * fails by breaking pages rather than by warning. Shipping one unverified
   * would claim a control the application does not actually have; it needs a
   * report-only rollout against real traffic first. The headers below are the
   * ones that are correct without per-page verification.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // The app is HTTPS-only on Vercel; this stops the first downgrade.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Clickjacking: nothing here is meant to be framed, including the
          // public report, which is a page rather than an embeddable widget.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          // Report URLs carry their token in the path, so a full referrer would
          // hand that token to every off-site link a reader follows.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=()" },
        ],
      },
    ];
  },
};

export default withWorkflow(nextConfig);
