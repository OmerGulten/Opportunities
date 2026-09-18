import { describe, expect, it } from "vitest";

import type { AIProvider, GenerateMessageInput, GeneratedMessage } from "@/types/ai";

import { sampleMessageInput } from "./fixtures";
import { generateWithGuard } from "./index";

const clean: GeneratedMessage = {
  subject: null,
  body: "Merhaba Kadıköy Kahve Evi ekibi, profilinizde web sitesi bağlantısı görünmüyor. Ayşe Yılmaz, Marmara Dijital",
  usedFacts: [],
  tone: "friendly_professional",
  channel: "email",
};

const dirty: GeneratedMessage = { ...clean, body: `${clean.body} Her gün müşteri kaybediyorsunuz; 15 dakikada çözeriz.` };

function scriptedProvider(outputs: GeneratedMessage[]) {
  const inputs: GenerateMessageInput[] = [];
  const provider: AIProvider = {
    name: "scripted",
    model: "test",
    isDemo: true,
    async generateMessage(input) {
      inputs.push(input);
      const output = outputs[Math.min(inputs.length - 1, outputs.length - 1)]!;
      return { output, meta: { provider: "scripted", model: "test", latencyMs: 1, inputTokens: null, outputTokens: null, promptVersion: "v1" } };
    },
    async analyzeOpportunity() {
      throw new Error("not used");
    },
  };
  return { provider, inputs };
}

describe("generateWithGuard", () => {
  it("returns the first result when the guard passes", async () => {
    const { provider, inputs } = scriptedProvider([clean]);
    const outcome = await generateWithGuard(provider, sampleMessageInput());
    expect(outcome.attempts).toBe(1);
    expect(outcome.guard.ok).toBe(true);
    expect(inputs).toHaveLength(1);
  });

  it("retries once with a corrective instruction and keeps the original instruction", async () => {
    const { provider, inputs } = scriptedProvider([dirty, clean]);
    const outcome = await generateWithGuard(provider, sampleMessageInput({ userInstruction: "Yerel olduğumuzu belirt" }));
    expect(outcome.attempts).toBe(2);
    expect(outcome.guard.ok).toBe(true);
    expect(outcome.result.output).toEqual(clean);
    expect(inputs[1]!.userInstruction).toContain("Yerel olduğumuzu belirt");
    expect(inputs[1]!.userInstruction).toContain("CORRECTION");
    expect(inputs[1]!.userInstruction).toContain('"15"');
  });

  it("returns the last result with its violations when the retry still fails", async () => {
    const { provider } = scriptedProvider([dirty, dirty]);
    const outcome = await generateWithGuard(provider, sampleMessageInput());
    expect(outcome.attempts).toBe(2);
    expect(outcome.guard.ok).toBe(false);
    expect(outcome.guard.violations.some((v) => v.type === "forbidden_phrase")).toBe(true);
    // The quoted fragments in the corrective note must not whitelist themselves.
    expect(outcome.guard.violations.some((v) => v.type === "unknown_number" && v.detail === "15")).toBe(true);
  });

  it("honours maxAttempts", async () => {
    const { provider, inputs } = scriptedProvider([dirty, clean]);
    const outcome = await generateWithGuard(provider, sampleMessageInput(), { maxAttempts: 1 });
    expect(outcome.attempts).toBe(1);
    expect(outcome.guard.ok).toBe(false);
    expect(inputs).toHaveLength(1);
  });
});
