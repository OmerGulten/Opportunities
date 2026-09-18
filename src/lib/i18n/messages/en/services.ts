import type { MessageTree } from "../../config";

/** Owned by the services feature. Fill in keys used by that feature; keep tr and en in sync. */
export const services: MessageTree = {
  title: "Services",
  description: "What you sell drives the scoring: a business is only scored for the services you offer.",
  selection: {
    title: "Services you sell",
    description: "A service that is off is not scored and never appears in recommendations.",
    enabled: "On",
    disabled: "Off",
    saved: "Service selection updated.",
    empty: "No service is defined.",
    atLeastOne: "At least one service must stay on.",
    selectedCount: "{{count}} services on",
  },
  offerings: {
    title: "Your packages",
    description:
      "Packages are used as context in message drafts. A price range is only what you entered; it is never presented as an estimate anywhere.",
    add: "Add package",
    edit: "Edit package",
    empty: "No package has been added yet.",
    emptyHint: "Add a package so drafts know what you sell and the range you work in.",
    created: "Package added.",
    updated: "Package updated.",
    deleted: "Package deleted.",
    deleteTitle: "Delete package",
    deleteDescription: "The package {{name}} is deleted. This cannot be undone.",
    fields: {
      service: "Service",
      name: "Package name",
      namePlaceholder: "For example: Corporate website",
      description: "Description",
      priceFrom: "Starting price",
      priceTo: "Top price",
      currency: "Currency",
      billingPeriod: "Billing",
      deliveryTime: "Delivery time",
      deliveryTimePlaceholder: "For example: 2-3 weeks",
      promptContext: "Draft note",
      promptContextHint: "Short context handed to the model when a draft is written. Do not write claims you cannot support.",
      enabled: "Enabled",
    },
    periods: {
      one_time: "One-off",
      monthly: "Monthly",
      yearly: "Yearly",
    },
    priceRange: {
      both: "{{from}} – {{to}}",
      fromOnly: "From {{from}}",
      toOnly: "Up to {{to}}",
      none: "No price entered",
    },
    errors: {
      nameRequired: "Enter a package name.",
      serviceRequired: "Choose a service.",
      priceRange: "The starting price cannot be higher than the top price.",
      priceInvalid: "A price must be zero or a larger number.",
    },
  },
  disabledNotice: "Services that are off are not used in scoring or recommendations.",
};
