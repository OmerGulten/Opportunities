import type { MessageTree } from "../../config";

/** Owned by the templates feature. Keys must stay identical to tr/templates.ts. */
export const templates: MessageTree = {
  title: "Templates",
  subtitle: "Ready-made texts that give a message draft its starting structure.",

  scope: {
    system: "Built-in templates",
    workspace: "Workspace templates",
    personal: "My personal templates",
    systemDescription: "Templates shipped with the platform. They are read-only; duplicate one to edit it.",
    workspaceDescription: "Templates everyone on the team can see and use.",
    personalDescription: "Templates only you can see.",
  },

  readOnly: "Read-only",
  readOnlyHint: "Built-in templates cannot be edited. Duplicate one and edit your own copy.",
  inactive: "Inactive",

  filters: {
    channel: "Channel",
    service: "Service",
    scope: "Scope",
    search: "Search",
    searchPlaceholder: "Template name or text",
    all: "All",
    noService: "No service selected",
    clear: "Clear filters",
  },

  card: {
    usage: "Used {{count}} times",
    locale: "Language",
    noService: "No service",
    noCategory: "No category",
    noSubject: "No subject",
    updated: "Updated: {{date}}",
    variables: "{{count}} variables",
  },

  actions: {
    new: "New template",
    edit: "Edit",
    duplicate: "Duplicate",
    duplicateToEdit: "Duplicate to edit",
    delete: "Delete",
    back: "Back to templates",
    save: "Save",
    saving: "Saving…",
    create: "Create template",
  },

  deleteConfirm: {
    title: "Delete this template?",
    description: "The template “{{name}}” is deleted permanently. Messages already created from it are not affected.",
    confirm: "Delete",
  },

  empty: {
    title: "You have no templates yet",
    description: "Start by duplicating a built-in template, or create one from scratch.",
    action: "New template",
  },

  noResults: {
    title: "No template matches these filters",
    description: "Clear the filters and try again.",
  },

  notFound: {
    title: "Template not found",
    description: "This template may have been deleted, or your access to it was removed.",
  },

  editor: {
    newTitle: "New template",
    editTitle: "Edit template",
    description: "Variables are filled from verified data when a draft is generated; variables with no value are cleanly removed from the text.",
    name: "Template name",
    namePlaceholder: "e.g. Cafés with no website",
    channel: "Channel",
    service: "Service",
    serviceNone: "No service selected",
    category: "Category",
    categoryNone: "No category selected",
    tone: "Tone",
    locale: "Template language",
    scope: "Scope",
    scopeWorkspace: "Workspace (visible to the team)",
    scopePersonal: "Personal (only me)",
    scopeHint: "The scope cannot be changed after the template is created.",
    subject: "Subject",
    subjectPlaceholder: "E-mail subject",
    subjectHint: "Used on the e-mail channel only.",
    body: "Text",
    bodyPlaceholder: "Hello {{business_name}}, …",
    active: "Active",
    activeHint: "Inactive templates are not listed on the message composer.",
    variables: {
      title: "Variables",
      description: "Click a variable to insert it at the cursor position.",
      insert: "Insert the {{name}} variable",
      used: "Used in this template",
      unknownTitle: "Unknown variable",
      unknown: "These variables have no value: {{names}}. A variable that cannot be produced from verified data cannot be saved.",
    },
    preview: {
      title: "Preview",
      description: "Resolved against sample values. In a real draft the values come from the business's verified data.",
      empty: "Write some text to see the preview.",
      subject: "Subject",
      body: "Text",
      missing: "Variables removed because the sample data has no value for them: {{names}}",
    },
    errors: {
      nameRequired: "The template name is required.",
      bodyRequired: "The template text cannot be empty.",
      bodyTooLong: "The template text can be at most 6000 characters.",
      subjectTooLong: "The subject can be at most 200 characters.",
      saveFailed: "The template could not be saved.",
      deleteFailed: "The template could not be deleted.",
      duplicateFailed: "The template could not be duplicated.",
      readOnly: "Built-in templates cannot be edited.",
    },
  },

  toast: {
    created: "Template created",
    updated: "Template updated",
    deleted: "Template deleted",
    duplicated: "Template duplicated",
  },
};
