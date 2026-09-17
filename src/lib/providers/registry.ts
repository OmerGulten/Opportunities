import "server-only";

import { getDemoFlags, serverEnv } from "@/lib/config/env";
import type { AIProvider } from "@/types/ai";
import type { PlaceProvider } from "@/types/places";

import { createDemoAIProvider } from "./ai/demo";
import { createOpenAIProvider } from "./ai/openai";
import type { PerformanceProvider } from "./performance/types";
import { createHeuristicPerformanceProvider } from "./performance/heuristic";
import { createPageSpeedProvider } from "./performance/pagespeed";
import { createDemoPlaceProvider } from "./places/demo";
import { createGooglePlacesProvider } from "./places/google";

/**
 * Provider selection. Driven by env: missing credentials or DEMO_MODE=true
 * select demo/heuristic implementations. Business logic depends only on the
 * interfaces, never on concrete providers.
 */

let placeProvider: PlaceProvider | null = null;
let aiProvider: AIProvider | null = null;
let performanceProvider: PerformanceProvider | null = null;

export function getPlaceProvider(): PlaceProvider {
  if (placeProvider) return placeProvider;
  const flags = getDemoFlags();
  placeProvider = flags.places ? createDemoPlaceProvider() : createGooglePlacesProvider({ apiKey: serverEnv().GOOGLE_PLACES_API_KEY! });
  return placeProvider;
}

export function getAIProvider(): AIProvider {
  if (aiProvider) return aiProvider;
  const flags = getDemoFlags();
  const env = serverEnv();
  aiProvider = flags.ai ? createDemoAIProvider({ model: env.OPENAI_MODEL }) : createOpenAIProvider({ apiKey: env.OPENAI_API_KEY!, model: env.OPENAI_MODEL });
  return aiProvider;
}

export function getPerformanceProvider(): PerformanceProvider {
  if (performanceProvider) return performanceProvider;
  const flags = getDemoFlags();
  performanceProvider = flags.pagespeed ? createHeuristicPerformanceProvider() : createPageSpeedProvider({ apiKey: serverEnv().GOOGLE_PAGESPEED_API_KEY! });
  return performanceProvider;
}

/** Test helper: reset cached providers. */
export function resetProviders() {
  placeProvider = null;
  aiProvider = null;
  performanceProvider = null;
}

export function getProviderStatus() {
  const flags = getDemoFlags();
  return {
    places: { provider: flags.places ? "demo" : "google_places", demo: flags.places },
    ai: { provider: flags.ai ? "demo" : "openai", demo: flags.ai, model: serverEnv().OPENAI_MODEL },
    performance: { provider: flags.pagespeed ? "heuristic" : "pagespeed", demo: flags.pagespeed },
    anyDemo: flags.any,
    forced: flags.forced,
  };
}
