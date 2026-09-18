import type { MessageTree } from "../../config";

/**
 * Owned by the legal pages. MessageTree has no arrays, so paragraphs use
 * numbered keys (p1..pN); the page files declare how many exist per section.
 */
export const legal: MessageTree = {
  meta: {
    lastUpdated: "Last updated: {{date}}",
    effectiveDate: "18 September 2026",
    contactTitle: "Contact",
    contactBody: "For questions about these documents and for data requests, reach us through the support channel inside the app.",
    tocTitle: "On this page",
    backHome: "Back to home",
  },
  terms: {
    title: "Terms of Service",
    summary: "The conditions that apply when you use OpportunityOS, your responsibilities and the limits of the service.",
    s1: {
      title: "1. Parties and scope",
      p1: "These terms govern the relationship between the natural or legal person using the OpportunityOS service (the “Service”) and the party operating it.",
      p2: "By creating an account or using the Service you accept these terms. If you do not accept them, do not use the Service.",
    },
    s2: {
      title: "2. What the Service does",
      p1: "The Service helps you discover the publicly visible digital presence of local businesses, audit observable gaps, see opportunity scores for the services you sell and prepare outreach drafts.",
      p2: "The Service does not predict purchase probability and does not promise to win customers for you. Scores are derived only from observed signals and configurable rules.",
      p3: "The Service depends on third-party providers (for example map and AI providers). Their outages or policy changes may affect some features.",
    },
    s3: {
      title: "3. Account and workspace",
      p1: "You are responsible for the security of your account and credentials, and for the actions of users you invite into your workspace.",
      p2: "Each workspace owns its own data. Workspace owners and admins manage members, the plan and the settings.",
    },
    s4: {
      title: "4. Acceptable use",
      p1: "You may not use the Service in breach of applicable law, in particular data protection and electronic commerce rules.",
      p2: "Bulk, automated or unsolicited messaging through the Service is not permitted. The Service does not send messages; it only prepares drafts, and both the decision and the act of sending are yours.",
      p3: "You may not copy, redistribute or permanently store provider data in breach of this agreement or the provider's own terms.",
    },
    s5: {
      title: "5. Credits and plans",
      p1: "Operations such as scans and AI generation spend credits. Credit costs are shown in the app and an estimate is presented before an operation starts.",
      p2: "Credits are reserved when an operation starts, consumed as work completes, and any unused reservation is refunded. Credits cannot be exchanged for cash.",
      p3: "Real payment processing is disabled in this release; plan changes are handled inside the app.",
    },
    s6: {
      title: "6. Intellectual property",
      p1: "The software, interface and brand of the Service belong to the operator. The data you enter into your workspace and the content you create belong to you.",
      p2: "You are granted a non-exclusive, non-transferable and time-limited right to use the Service.",
    },
    s7: {
      title: "7. Limitation of liability",
      p1: "The Service is provided “as is”. Scores, findings and drafts are decision support; you remain responsible for the outcome of your commercial decisions.",
      p2: "Liability for indirect damages, loss of profit and loss of data is limited to the maximum extent permitted by applicable law.",
    },
    s8: {
      title: "8. Suspension and termination",
      p1: "Your account or workspace may be suspended if these terms are breached. You may close your account at any time.",
      p2: "After closure your data is deleted or anonymised in line with the retention periods in the Privacy Policy.",
    },
    s9: {
      title: "9. Changes and governing law",
      p1: "These terms may be updated. Material changes are announced in the app and the update date on this page is refreshed.",
      p2: "Disputes are governed by the laws of the Republic of Türkiye.",
    },
  },
  privacy: {
    title: "Privacy Policy",
    summary: "What data we process, why, who we share it with, and your rights under KVKK.",
    s1: {
      title: "1. Controller and scope",
      p1: "This policy explains the personal data processed when using OpportunityOS, within the framework of Turkish Personal Data Protection Law No. 6698 (KVKK) and related legislation.",
      p2: "It covers account holders, workspace members and the business contact details that appear in discovery results.",
    },
    s2: {
      title: "2. Data we process",
      p1: "Account data: full name, email address, language and interface preference, workspace membership and role.",
      p2: "Usage data: scan records, credit movements, provider call logs (duration, result, error code) and in-app activity history.",
      p3: "Business data: publicly available business information from the map provider (name, address, phone, website, review counts) and the findings produced by audits. This data mostly concerns businesses, but for sole traders it may qualify as personal data.",
    },
    s3: {
      title: "3. Purposes and legal bases",
      p1: "Creating your account, maintaining your session and delivering the service: formation and performance of the contract.",
      p2: "Credit accounting, abuse prevention, security logging and debugging: legitimate interest and legal obligation.",
      p3: "Service improvement and aggregate statistics: legitimate interest. Aggregated data is used wherever possible for this purpose.",
    },
    s4: {
      title: "4. Processors and international transfers",
      p1: "Hosting and database: the application infrastructure and Supabase (Postgres, authentication).",
      p2: "Map and business data: Google Maps Platform (Places API). Your queries and area selections are sent to this provider; provider data is retained only to the extent and for the period its terms allow.",
      p3: "AI drafts: OpenAI. Verified findings about a business and the service information you provide are sent for draft generation. Account passwords, API keys and payment details are never sent.",
      p4: "These providers may operate servers abroad; transfers are made under the international transfer provisions of KVKK.",
    },
    s5: {
      title: "5. Retention",
      p1: "Account and workspace data is kept while your account is active.",
      p2: "Content from the map provider is cached only for the period the provider's policy allows; after that it is refreshed or deleted. Only the provider identifier (place id) is stored indefinitely.",
      p3: "Audit and access logs are kept for up to 12 months; credit ledger entries are kept for the lifetime of the account for accounting integrity.",
    },
    s6: {
      title: "6. Your rights under KVKK",
      p1: "You have the right to learn whether your personal data is processed, to request information about it, and to learn the purpose of processing and whether the data is used in line with that purpose.",
      p2: "You may request correction of incomplete or inaccurate data, deletion or destruction under the conditions set out in the legislation, and notification of these actions to third parties the data was transferred to.",
      p3: "You may object to an adverse outcome produced solely by automated analysis, and claim compensation for damage caused by unlawful processing.",
    },
    s7: {
      title: "7. Deletion and export",
      p1: "You can request workspace and account deletion from inside the app. Once received, data is deleted or irreversibly anonymised; records subject to a statutory retention obligation are kept until that period ends.",
      p2: "You can take your workspace data with you using the export options in the app.",
    },
    s8: {
      title: "8. Security",
      p1: "Data is encrypted in transit; database access is restricted per workspace with row level security policies.",
      p2: "All requests to external addresses go through a hardened client that blocks access to internal network resources. Passwords, keys and message bodies are never written to logs.",
    },
    s9: {
      title: "9. Automated decisions and AI",
      p1: "Opportunity scores are calculated automatically but serve only as decision support; they take no action on your behalf and produce no legal effect concerning a person.",
      p2: "AI output is a draft and is reviewed by you before it is sent. See the AI Disclosure page for details.",
    },
    s10: {
      title: "10. Changes",
      p1: "This policy may be updated. The current version is always published on this page and the update date above is refreshed.",
    },
  },
  cookies: {
    title: "Cookie Policy",
    summary: "Only essential cookies are used; there are no advertising or third-party tracking cookies.",
    s1: {
      title: "1. Cookies we use",
      p1: "Session cookie: set by the authentication provider to keep you signed in. The app does not work without it.",
      p2: "Workspace preference: remembers the workspace you used last and is validated on the server.",
      p3: "Language and interface preference: remembers your language and light/dark theme choice.",
    },
    s2: {
      title: "2. Cookies we do not use",
      p1: "No advertising, profiling or third-party analytics cookies are used. For this reason the cookie notice is informational rather than a consent choice screen.",
    },
    s3: {
      title: "3. Managing cookies",
      p1: "You can delete or block cookies in your browser settings. If you block the essential cookies you will not be able to sign in or use the app.",
    },
    s4: {
      title: "4. Local storage",
      p1: "Interface preferences (for example keeping the sidebar open, or having dismissed the cookie notice) are kept in your browser's local storage and are not sent to the server.",
    },
  },
  ai: {
    title: "AI Disclosure",
    summary: "Where AI is used, what data it works with and the limits it operates under.",
    s1: {
      title: "1. Where AI is used",
      p1: "AI is used only to write outreach drafts and to summarise findings in human language.",
      p2: "Opportunity scores are not produced by AI. They come from an explicit, auditable rule engine that runs over observed signals.",
    },
    s2: {
      title: "2. Data sent to the model",
      p1: "Only verified findings from the audit, basic public information about the business, and the service and package details you defined are sent to the model.",
      p2: "Content fetched from websites is treated as untrusted data; it is given to the model as material to review, never as instructions.",
      p3: "Account passwords, session data, API keys and payment details are never sent to the model.",
    },
    s3: {
      title: "3. Bound to the facts",
      p1: "Drafts may not go beyond the findings they were given. If the output asserts a fact that was not supplied, an automatic check flags it and the text is regenerated or the claim is removed.",
      p2: "Language models can still make mistakes. Reading the text and confirming its accuracy before sending remains the user's responsibility.",
    },
    s4: {
      title: "4. Sending is your decision",
      p1: "The app never sends a message automatically. Drafts are copied, or the relevant channel is opened by you and the message is sent manually.",
      p2: "Bulk and unsolicited messaging is against the Terms of Service.",
    },
    s5: {
      title: "5. Provider and opting out",
      p1: "OpenAI is used for text generation. If provider credentials are not configured, the app falls back to a demo provider with fictional examples and shows a “Demo data” label in the interface.",
      p2: "You can run the discovery, audit and scoring loop without using the AI features at all.",
    },
  },
};
