import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { canonicalFingerprint } from "@/features/businesses/dedupe";

import { fingerprintsFromSnapshots } from "./fingerprints";

interface SnapshotRow {
  business_id: string;
  display_name: string;
  formatted_address: string | null;
  lat: number | null;
  lng: number | null;
}

/** Minimal chainable fake of the PostgREST builder this helper uses. */
function fakeClient(pages: SnapshotRow[][]) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  let pageIndex = 0;
  const builder: Record<string, (...args: unknown[]) => unknown> = {};
  for (const method of ["select", "in", "order"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.returns = () => {
    const page = pages[pageIndex] ?? [];
    pageIndex += 1;
    return Promise.resolve({ data: page, error: null });
  };
  const from = vi.fn(() => builder);
  return { client: { from } as unknown as SupabaseClient, from, calls };
}

const cafe = { business_id: "b1", display_name: "Cafe Benazio", formatted_address: "Moda Cad. 1, Kadıköy", lat: 40.9873, lng: 29.0257 };

describe("fingerprintsFromSnapshots", () => {
  it("reads identity from the provider cache, not from businesses", async () => {
    const { client, from } = fakeClient([[cafe]]);
    const result = await fingerprintsFromSnapshots(client, ["b1"]);

    // The whole point of the change: businesses never expires, so the matching
    // material has to come from the snapshot cache that does.
    expect(from).toHaveBeenCalledWith("business_provider_snapshots");
    expect(result.get("b1")).toBe(
      canonicalFingerprint({ name: cafe.display_name, address: cafe.formatted_address, lat: cafe.lat, lng: cafe.lng }),
    );
  });

  it("gives the same fingerprint to two listings of one business", async () => {
    // The case this exists for: one shop listed twice under different place ids.
    // businesses is unique on (workspace, provider, place id), so only a name and
    // address match can catch it.
    const duplicate = { ...cafe, business_id: "b2" };
    const { client } = fakeClient([[cafe, duplicate]]);

    const result = await fingerprintsFromSnapshots(client, ["b1", "b2"]);
    expect(result.get("b1")).toBe(result.get("b2"));
  });

  it("separates businesses that only look similar", async () => {
    const other = { ...cafe, business_id: "b2", display_name: "Cafe Benazio", formatted_address: "Bahariye Cad. 90, Kadıköy" };
    const { client } = fakeClient([[cafe, other]]);

    const result = await fingerprintsFromSnapshots(client, ["b1", "b2"]);
    expect(result.get("b1")).not.toBe(result.get("b2"));
  });

  it("keeps the freshest snapshot when a business has several", async () => {
    // Rows arrive newest first; a deeper re-fetch must not be overwritten by the
    // discovery-level snapshot recorded before it.
    const newest = { ...cafe, display_name: "Cafe Benazio Kadıköy" };
    const { client } = fakeClient([[newest, cafe]]);

    const result = await fingerprintsFromSnapshots(client, ["b1"]);
    expect(result.get("b1")).toBe(
      canonicalFingerprint({ name: newest.display_name, address: newest.formatted_address, lat: newest.lat, lng: newest.lng }),
    );
  });

  it("orders newest first so that rule can hold", async () => {
    const { client, calls } = fakeClient([[cafe]]);
    await fingerprintsFromSnapshots(client, ["b1"]);

    expect(calls).toContainEqual({ method: "order", args: ["fetched_at", { ascending: false }] });
  });

  it("asks for nothing when the scan found nothing", async () => {
    const { client, from } = fakeClient([[]]);
    const result = await fingerprintsFromSnapshots(client, []);

    expect(result.size).toBe(0);
    expect(from).not.toHaveBeenCalled();
  });

  it("batches large scans instead of building one enormous URL", async () => {
    const ids = Array.from({ length: 450 }, (_, i) => `b${i}`);
    const { client, from } = fakeClient([[], [], []]);
    await fingerprintsFromSnapshots(client, ids);

    expect(from).toHaveBeenCalledTimes(3);
  });

  it("collapses repeated ids before querying", async () => {
    const { client, calls } = fakeClient([[cafe]]);
    await fingerprintsFromSnapshots(client, ["b1", "b1", "b1"]);

    const inCall = calls.find((call) => call.method === "in");
    expect(inCall?.args[1]).toEqual(["b1"]);
  });
});
