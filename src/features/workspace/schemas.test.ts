import { describe, expect, it } from "vitest";

import {
  createWorkspaceSchema,
  isReservedSlug,
  offeringSchema,
  saveOfferingsSchema,
  switchWorkspaceSchema,
  toneSchema,
  workspaceProfileSchema,
  workspaceServicesSchema,
} from "./schemas";

const SERVICE_ID = "3f1d2b24-9c0e-4a51-8a4f-1f2b3c4d5e6f";
const OTHER_ID = "8b7c6d5e-4f3a-2b1c-9d8e-7f6a5b4c3d2e";

function baseOffering(overrides: Record<string, unknown> = {}) {
  return {
    serviceId: SERVICE_ID,
    name: "Website package",
    priceFrom: 1000,
    priceTo: 2000,
    currency: "TRY",
    billingPeriod: "one_time" as const,
    deliveryTime: "2-3 weeks",
    ...overrides,
  };
}

describe("createWorkspaceSchema", () => {
  it("trims the name", () => {
    const result = createWorkspaceSchema.safeParse({ name: "  Blue Agency  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Blue Agency");
  });

  it("rejects names shorter than two characters with a stable key", () => {
    const result = createWorkspaceSchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe("nameTooShort");
  });

  it("rejects names longer than 60 characters", () => {
    const result = createWorkspaceSchema.safeParse({ name: "a".repeat(61) });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe("nameTooLong");
  });

  it("treats whitespace-only input as too short", () => {
    expect(createWorkspaceSchema.safeParse({ name: "   " }).success).toBe(false);
  });
});

describe("switchWorkspaceSchema", () => {
  it("accepts a uuid", () => {
    expect(switchWorkspaceSchema.safeParse({ workspaceId: SERVICE_ID }).success).toBe(true);
  });

  it("rejects anything else", () => {
    const result = switchWorkspaceSchema.safeParse({ workspaceId: "not-a-uuid" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe("invalidId");
  });
});

describe("workspaceServicesSchema", () => {
  it("requires at least one service", () => {
    const result = workspaceServicesSchema.safeParse({ serviceIds: [] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe("atLeastOneService");
  });

  it("accepts a list of uuids", () => {
    expect(workspaceServicesSchema.safeParse({ serviceIds: [SERVICE_ID, OTHER_ID] }).success).toBe(true);
  });

  it("rejects non-uuid members", () => {
    expect(workspaceServicesSchema.safeParse({ serviceIds: [SERVICE_ID, "x"] }).success).toBe(false);
  });
});

describe("offeringSchema", () => {
  it("accepts a complete offering", () => {
    expect(offeringSchema.safeParse(baseOffering()).success).toBe(true);
  });

  it("allows both prices to be null", () => {
    const result = offeringSchema.safeParse(baseOffering({ priceFrom: null, priceTo: null }));
    expect(result.success).toBe(true);
  });

  it("allows an open-ended upper price", () => {
    expect(offeringSchema.safeParse(baseOffering({ priceTo: null })).success).toBe(true);
  });

  it("rejects an upper price below the starting price", () => {
    const result = offeringSchema.safeParse(baseOffering({ priceFrom: 3000, priceTo: 1000 }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("priceRange");
      expect(result.error.issues[0]?.path).toEqual(["priceTo"]);
    }
  });

  it("rejects negative prices", () => {
    const result = offeringSchema.safeParse(baseOffering({ priceFrom: -1 }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe("priceInvalid");
  });

  it("requires a name", () => {
    const result = offeringSchema.safeParse(baseOffering({ name: "   " }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe("offeringNameRequired");
  });

  it("defaults the currency to TRY", () => {
    const withoutCurrency: Record<string, unknown> = baseOffering();
    delete withoutCurrency.currency;
    const result = offeringSchema.safeParse(withoutCurrency);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.currency).toBe("TRY");
  });

  it("rejects an unknown billing period", () => {
    expect(offeringSchema.safeParse(baseOffering({ billingPeriod: "weekly" })).success).toBe(false);
  });
});

describe("saveOfferingsSchema", () => {
  it("accepts an empty list", () => {
    expect(saveOfferingsSchema.safeParse({ offerings: [] }).success).toBe(true);
  });

  it("validates every entry", () => {
    const result = saveOfferingsSchema.safeParse({ offerings: [baseOffering(), baseOffering({ name: "" })] });
    expect(result.success).toBe(false);
  });
});

describe("toneSchema", () => {
  it("accepts the supported tones", () => {
    expect(toneSchema.safeParse("friendly_professional").success).toBe(true);
    expect(toneSchema.safeParse("concise").success).toBe(true);
  });

  it("rejects unknown tones", () => {
    expect(toneSchema.safeParse("angry").success).toBe(false);
  });
});

describe("workspaceProfileSchema", () => {
  const base = {
    defaultTone: "formal",
    senderName: null,
    senderTitle: null,
    senderPhone: null,
    senderEmail: null,
    companyName: null,
    companyWebsite: null,
    companyDescription: null,
  };

  it("keeps null optional fields null", () => {
    const result = workspaceProfileSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.senderName).toBeNull();
      expect(result.data.companyWebsite).toBeNull();
    }
  });

  it("normalises empty strings to null", () => {
    const result = workspaceProfileSchema.safeParse({ ...base, senderName: "  ", senderEmail: "", companyWebsite: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.senderName).toBeNull();
      expect(result.data.senderEmail).toBeNull();
      expect(result.data.companyWebsite).toBeNull();
    }
  });

  it("rejects an invalid email", () => {
    const result = workspaceProfileSchema.safeParse({ ...base, senderEmail: "nope" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe("emailInvalid");
  });

  it("rejects a website without an http(s) scheme", () => {
    const result = workspaceProfileSchema.safeParse({ ...base, companyWebsite: "example.com" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe("urlInvalid");
  });

  it("accepts an https website", () => {
    const result = workspaceProfileSchema.safeParse({ ...base, companyWebsite: "https://example.com" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.companyWebsite).toBe("https://example.com");
  });

  it("rejects an unknown tone", () => {
    expect(workspaceProfileSchema.safeParse({ ...base, defaultTone: "shouty" }).success).toBe(false);
  });
});

describe("isReservedSlug", () => {
  it("flags top-level route collisions", () => {
    expect(isReservedSlug("admin")).toBe(true);
    expect(isReservedSlug("sign-in")).toBe(true);
  });

  it("allows normal slugs", () => {
    expect(isReservedSlug("blue-agency")).toBe(false);
  });
});
