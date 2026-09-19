import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";

import { appendReference, diagnosticCode, withReferenceCode } from "./reference";

/** The shape supabase-js hands back for a failed PostgREST call. */
const postgrestError = {
  code: "42P17",
  message: 'infinite recursion detected in policy for relation "profiles"',
  details: null,
  hint: null,
};

describe("diagnosticCode", () => {
  it("reads a SQLSTATE off a PostgREST error", () => {
    expect(diagnosticCode(postgrestError)).toBe("42P17");
  });

  it("reads a PostgREST code", () => {
    expect(diagnosticCode({ code: "PGRST200", message: "could not find a relationship" })).toBe("PGRST200");
  });

  it("reads a Node system error code", () => {
    const err = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    expect(diagnosticCode(err)).toBe("ECONNREFUSED");
  });

  it("unwraps one level of cause", () => {
    expect(diagnosticCode(new Error("wrapped", { cause: postgrestError }))).toBe("42P17");
  });

  it("returns null for an AppError, whose code already travels as the result code", () => {
    expect(diagnosticCode(new AppError("forbidden", "nope"))).toBeNull();
  });

  it("returns null when there is nothing more specific than a failure", () => {
    expect(diagnosticCode(new Error("boom"))).toBeNull();
    expect(diagnosticCode(null)).toBeNull();
    expect(diagnosticCode(undefined)).toBeNull();
    expect(diagnosticCode("boom")).toBeNull();
    expect(diagnosticCode({})).toBeNull();
  });

  it("rejects a `code` that is prose rather than an identifier", () => {
    // Guards the privacy rule below: only short identifiers travel, never text
    // that might quote the caller's own data.
    expect(diagnosticCode({ code: "the value 'omer@example.com' already exists" })).toBeNull();
    expect(diagnosticCode({ code: "has spaces" })).toBeNull();
  });
});

describe("withReferenceCode", () => {
  it("leaves the sentence alone when there is no reference", () => {
    expect(withReferenceCode("Kaydedilemedi.", null, "tr")).toBe("Kaydedilemedi.");
  });

  it("appends the code in both locales", () => {
    expect(withReferenceCode("Kaydedilemedi.", "42P17", "tr")).toContain("42P17");
    expect(withReferenceCode("Kaydedilemedi.", "42P17", "tr")).toContain("Kaydedilemedi.");
    expect(withReferenceCode("Could not save.", "42P17", "en")).toContain("42P17");
    expect(withReferenceCode("Could not save.", "42P17", "en")).toContain("Could not save.");
  });

  it("carries a validation field path, not only driver codes", () => {
    expect(withReferenceCode("Kaydedilemedi.", "companyWebsite", "tr")).toContain("companyWebsite");
  });
});

describe("appendReference", () => {
  it("never puts the driver's message on screen", () => {
    // The driver's text can quote the row it choked on; only the code travels.
    const shown = appendReference("Kaydedilemedi.", postgrestError, "tr");
    expect(shown).toContain("42P17");
    expect(shown).not.toContain("profiles");
    expect(shown).not.toContain("infinite recursion");
  });

  it("returns the sentence unchanged when the cause carries no code", () => {
    expect(appendReference("Kaydedilemedi.", new Error("boom"), "tr")).toBe("Kaydedilemedi.");
  });
});
