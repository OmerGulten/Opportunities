"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog, EmptyState, ServiceIcon } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { addOffering, editOffering, removeOffering } from "@/features/settings/actions";
import { useFormatters, useT } from "@/lib/i18n/client";

export type BillingPeriod = "one_time" | "monthly" | "yearly";

export interface OfferingServiceOption {
  id: string;
  /** Already localized by the server component. */
  name: string;
  icon: string | null;
}

export interface OfferingItem {
  id: string;
  serviceId: string;
  name: string;
  description: string | null;
  priceFrom: number | null;
  priceTo: number | null;
  currency: string;
  billingPeriod: BillingPeriod;
  deliveryTime: string | null;
  promptContext: string | null;
  enabled: boolean;
  sortOrder: number;
}

export interface OfferingsManagerProps {
  offerings: OfferingItem[];
  services: OfferingServiceOption[];
  canEdit: boolean;
}

const CURRENCIES = ["TRY", "USD", "EUR"];
const BILLING_PERIODS: BillingPeriod[] = ["one_time", "monthly", "yearly"];

interface Draft {
  serviceId: string;
  name: string;
  description: string;
  priceFrom: string;
  priceTo: string;
  currency: string;
  billingPeriod: BillingPeriod;
  deliveryTime: string;
  promptContext: string;
  enabled: boolean;
}

function emptyDraft(serviceId: string): Draft {
  return {
    serviceId,
    name: "",
    description: "",
    priceFrom: "",
    priceTo: "",
    currency: "TRY",
    billingPeriod: "one_time",
    deliveryTime: "",
    promptContext: "",
    enabled: true,
  };
}

function toDraft(offering: OfferingItem): Draft {
  return {
    serviceId: offering.serviceId,
    name: offering.name,
    description: offering.description ?? "",
    priceFrom: offering.priceFrom === null ? "" : String(offering.priceFrom),
    priceTo: offering.priceTo === null ? "" : String(offering.priceTo),
    currency: offering.currency,
    billingPeriod: offering.billingPeriod,
    deliveryTime: offering.deliveryTime ?? "",
    promptContext: offering.promptContext ?? "",
    enabled: offering.enabled,
  };
}

function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** "" means "not priced", anything unparseable is reported rather than coerced. */
function parsePrice(value: string): number | null | "invalid" {
  const trimmed = value.trim().replace(",", ".");
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return "invalid";
  return parsed;
}

/**
 * Offering CRUD.
 *
 * Offerings are what the workspace sells; message drafts read them as context.
 * A price range is shown exactly as it was typed — it is never presented as an
 * estimate or a quote.
 */
export function OfferingsManager({ offerings, services, canEdit }: OfferingsManagerProps) {
  const t = useT("services");
  const tc = useT("common");
  const router = useRouter();
  const { currency: formatCurrency } = useFormatters();
  const [pending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(services[0]?.id ?? ""));
  const [error, setError] = useState<string | null>(null);

  const serviceName = (id: string) => services.find((service) => service.id === id)?.name ?? id;
  const serviceIcon = (id: string) => services.find((service) => service.id === id)?.icon ?? null;

  function openCreate() {
    setEditingId(null);
    setDraft(emptyDraft(services[0]?.id ?? ""));
    setError(null);
    setOpen(true);
  }

  function openEdit(offering: OfferingItem) {
    setEditingId(offering.id);
    setDraft(toDraft(offering));
    setError(null);
    setOpen(true);
  }

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    if (draft.serviceId.length === 0) {
      setError(t("offerings.errors.serviceRequired"));
      return;
    }
    if (draft.name.trim().length < 2) {
      setError(t("offerings.errors.nameRequired"));
      return;
    }
    const priceFrom = parsePrice(draft.priceFrom);
    const priceTo = parsePrice(draft.priceTo);
    if (priceFrom === "invalid" || priceTo === "invalid") {
      setError(t("offerings.errors.priceInvalid"));
      return;
    }
    if (priceFrom !== null && priceTo !== null && priceFrom > priceTo) {
      setError(t("offerings.errors.priceRange"));
      return;
    }
    setError(null);

    const payload = {
      serviceId: draft.serviceId,
      name: draft.name.trim(),
      description: orNull(draft.description),
      priceFrom,
      priceTo,
      currency: draft.currency,
      billingPeriod: draft.billingPeriod,
      deliveryTime: orNull(draft.deliveryTime),
      promptContext: orNull(draft.promptContext),
      enabled: draft.enabled,
      sortOrder: 0,
    };

    startTransition(async () => {
      const result = editingId ? await editOffering({ ...payload, id: editingId }) : await addOffering(payload);
      if (!result.ok) {
        setError(result.error.message);
        toast.error(result.error.message);
        return;
      }
      toast.success(editingId ? t("offerings.updated") : t("offerings.created"));
      setOpen(false);
      router.refresh();
    });
  }

  async function confirmDelete(offering: OfferingItem) {
    const result = await removeOffering({ id: offering.id });
    if (!result.ok) {
      toast.error(result.error.message);
      throw new Error(result.error.code);
    }
    toast.success(t("offerings.deleted"));
    router.refresh();
  }

  function priceLabel(offering: OfferingItem): string {
    const from = offering.priceFrom === null ? null : formatCurrency(offering.priceFrom, offering.currency);
    const to = offering.priceTo === null ? null : formatCurrency(offering.priceTo, offering.currency);
    if (from && to) return t("offerings.priceRange.both", { from, to });
    if (from) return t("offerings.priceRange.fromOnly", { from });
    if (to) return t("offerings.priceRange.toOnly", { to });
    return t("offerings.priceRange.none");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("offerings.title")}</CardTitle>
        <CardDescription>{t("offerings.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {offerings.length === 0 ? (
          <EmptyState
            title={t("offerings.empty")}
            description={t("offerings.emptyHint")}
            action={
              canEdit ? (
                <Button onClick={openCreate} disabled={services.length === 0}>
                  <Plus />
                  {t("offerings.add")}
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {offerings.map((offering) => (
                <Item key={offering.id} variant="outline">
                  <ItemMedia variant="icon">
                    <ServiceIcon icon={serviceIcon(offering.serviceId)} colored={offering.enabled} />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle className="flex flex-wrap items-center gap-2">
                      {offering.name}
                      <Badge variant="outline" className="font-normal">
                        {serviceName(offering.serviceId)}
                      </Badge>
                      {offering.enabled ? null : (
                        <Badge variant="outline" className="font-normal text-muted-foreground">
                          {t("selection.disabled")}
                        </Badge>
                      )}
                    </ItemTitle>
                    <ItemDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="tabular-nums">{priceLabel(offering)}</span>
                      <span>{t(`offerings.periods.${offering.billingPeriod}`)}</span>
                      {offering.deliveryTime ? <span>{offering.deliveryTime}</span> : null}
                    </ItemDescription>
                  </ItemContent>
                  {canEdit ? (
                    <ItemActions>
                      <Button variant="ghost" size="icon-sm" aria-label={t("offerings.edit")} onClick={() => openEdit(offering)}>
                        <Pencil />
                      </Button>
                      <ConfirmDialog
                        title={t("offerings.deleteTitle")}
                        description={t("offerings.deleteDescription", { name: offering.name })}
                        confirmLabel={tc("actions.delete")}
                        destructive
                        onConfirm={() => confirmDelete(offering)}
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label={tc("actions.delete")}>
                            <Trash2 />
                          </Button>
                        }
                      />
                    </ItemActions>
                  ) : null}
                </Item>
              ))}
            </div>
            {canEdit ? (
              <div>
                <Button variant="outline" onClick={openCreate} disabled={services.length === 0}>
                  <Plus />
                  {t("offerings.add")}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={(next) => setOpen(next)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? t("offerings.edit") : t("offerings.add")}</DialogTitle>
            <DialogDescription>{t("offerings.description")}</DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="offering-service">{t("offerings.fields.service")}</FieldLabel>
              <Select
                value={draft.serviceId}
                onValueChange={(value) => {
                  if (typeof value === "string") set("serviceId", value);
                }}
              >
                <SelectTrigger id="offering-service" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="offering-name">{t("offerings.fields.name")}</FieldLabel>
              <Input
                id="offering-name"
                value={draft.name}
                maxLength={120}
                placeholder={t("offerings.fields.namePlaceholder")}
                onChange={(event) => set("name", event.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="offering-description">{t("offerings.fields.description")}</FieldLabel>
              <Textarea
                id="offering-description"
                rows={2}
                maxLength={1000}
                value={draft.description}
                onChange={(event) => set("description", event.target.value)}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="offering-price-from">{t("offerings.fields.priceFrom")}</FieldLabel>
                <Input
                  id="offering-price-from"
                  inputMode="decimal"
                  value={draft.priceFrom}
                  onChange={(event) => set("priceFrom", event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="offering-price-to">{t("offerings.fields.priceTo")}</FieldLabel>
                <Input
                  id="offering-price-to"
                  inputMode="decimal"
                  value={draft.priceTo}
                  onChange={(event) => set("priceTo", event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="offering-currency">{t("offerings.fields.currency")}</FieldLabel>
                <Select
                  value={draft.currency}
                  onValueChange={(value) => {
                    if (typeof value === "string") set("currency", value);
                  }}
                >
                  <SelectTrigger id="offering-currency" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="offering-period">{t("offerings.fields.billingPeriod")}</FieldLabel>
                <Select
                  value={draft.billingPeriod}
                  onValueChange={(value) => {
                    if (typeof value === "string") set("billingPeriod", value as BillingPeriod);
                  }}
                >
                  <SelectTrigger id="offering-period" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_PERIODS.map((period) => (
                      <SelectItem key={period} value={period}>
                        {t(`offerings.periods.${period}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="offering-delivery">{t("offerings.fields.deliveryTime")}</FieldLabel>
                <Input
                  id="offering-delivery"
                  value={draft.deliveryTime}
                  maxLength={80}
                  placeholder={t("offerings.fields.deliveryTimePlaceholder")}
                  onChange={(event) => set("deliveryTime", event.target.value)}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="offering-prompt">{t("offerings.fields.promptContext")}</FieldLabel>
              <Textarea
                id="offering-prompt"
                rows={3}
                maxLength={1000}
                value={draft.promptContext}
                onChange={(event) => set("promptContext", event.target.value)}
              />
              <FieldDescription>{t("offerings.fields.promptContextHint")}</FieldDescription>
            </Field>

            <Field orientation="horizontal">
              <FieldLabel htmlFor="offering-enabled">{t("offerings.fields.enabled")}</FieldLabel>
              <Switch id="offering-enabled" checked={draft.enabled} onCheckedChange={(checked) => set("enabled", checked === true)} />
            </Field>

            {error ? <FieldError>{error}</FieldError> : null}
          </FieldGroup>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              {tc("actions.cancel")}
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? <Spinner /> : null}
              {tc("actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
