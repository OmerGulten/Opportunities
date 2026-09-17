import type { Locale } from "@/types/common";

export const NAMESPACES = [
  "common",
  "nav",
  "auth",
  "onboarding",
  "dashboard",
  "scans",
  "businesses",
  "opportunities",
  "pipeline",
  "messages",
  "templates",
  "analytics",
  "settings",
  "billing",
  "admin",
  "reports",
  "legal",
  "errors",
  "findings",
  "services",
  "marketing",
] as const;

export type Namespace = (typeof NAMESPACES)[number];

/** Nested string tree. Leaves are strings with optional {{param}} placeholders. */
export type MessageTree = { [key: string]: string | MessageTree };

export type Dictionary = Record<Namespace, MessageTree>;

export function isLocale(value: unknown): value is Locale {
  return value === "tr" || value === "en";
}

export const LOCALE_LABELS: Record<Locale, string> = { tr: "Türkçe", en: "English" };
