import Link from "next/link";

import { ConfidenceBadge, KeyValueList, type KeyValueItem } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import type { BusinessDetail } from "@/features/businesses/queries";
import { getT, pickLocalized } from "@/lib/i18n";
import type { Locale } from "@/types/common";

import { formatDateTime, formatNumber } from "./summaries";
import { BoolValue, TextValue } from "./value-cells";

export interface BusinessInfoProps {
  detail: BusinessDetail;
  locale: Locale;
}

const CONTACT_TYPES = new Set(["phone", "whatsapp", "email", "instagram", "facebook", "website", "other"]);
const CONTACT_SOURCES = new Set(["provider", "website", "manual", "derived"]);

/** Provider profile fields plus the contact channels stored for the business. */
export function BusinessInfo({ detail, locale }: BusinessInfoProps) {
  const t = getT(locale, "businesses");
  const tc = getT(locale, "common");
  const snapshot = detail.snapshot;

  const items: KeyValueItem[] = [
    { key: "address", label: t("detail.info.address"), value: <TextValue value={snapshot?.formatted_address ?? null} /> },
    { key: "city", label: t("detail.info.city"), value: <TextValue value={snapshot?.city ?? null} /> },
    { key: "district", label: t("detail.info.district"), value: <TextValue value={snapshot?.district ?? null} /> },
    {
      key: "category",
      label: t("detail.info.category"),
      value: <TextValue value={detail.category ? pickLocalized(detail.category, "name", locale) : null} />,
      hint: snapshot?.primary_type ? `${t("detail.info.primaryType")}: ${snapshot.primary_type}` : undefined,
    },
    {
      key: "phone",
      label: t("detail.info.phone"),
      value: snapshot?.phone_national ? (
        <Link href={`tel:${snapshot.phone_international ?? snapshot.phone_national}`} className="text-sm hover:underline">
          {snapshot.phone_national}
        </Link>
      ) : (
        <TextValue value={null} />
      ),
    },
    {
      key: "website",
      label: t("detail.info.website"),
      value: snapshot?.website_uri ? (
        <Link href={snapshot.website_uri} target="_blank" rel="noreferrer noopener" className="text-sm break-all hover:underline">
          {snapshot.website_uri}
        </Link>
      ) : (
        <TextValue value={null} />
      ),
    },
    {
      key: "rating",
      label: t("detail.info.rating"),
      value: <TextValue value={formatNumber(snapshot?.rating ?? null, locale, { maximumFractionDigits: 1 })} />,
    },
    { key: "reviews", label: t("detail.info.reviews"), value: <TextValue value={formatNumber(snapshot?.user_rating_count ?? null, locale)} /> },
    { key: "photos", label: t("detail.info.photos"), value: <TextValue value={formatNumber(snapshot?.photo_count ?? null, locale)} /> },
    {
      key: "hours",
      label: t("detail.info.hours"),
      value: <BoolValue value={snapshot?.has_opening_hours ?? null} />,
      hint: snapshot?.has_opening_hours === true ? t("detail.info.hoursPresent") : snapshot?.has_opening_hours === false ? t("detail.info.hoursAbsent") : undefined,
    },
    { key: "businessStatus", label: t("detail.info.businessStatus"), value: <TextValue value={snapshot?.business_status ?? null} /> },
    {
      key: "coordinates",
      label: t("detail.info.coordinates"),
      value: (
        <TextValue
          value={
            snapshot?.lat !== null && snapshot?.lat !== undefined && snapshot?.lng !== null && snapshot?.lng !== undefined
              ? `${snapshot.lat.toFixed(5)}, ${snapshot.lng.toFixed(5)}`
              : null
          }
        />
      ),
    },
    { key: "provider", label: t("detail.info.provider"), value: <TextValue value={detail.business.provider} /> },
    {
      key: "providerPlaceId",
      label: t("detail.info.providerPlaceId"),
      value: <span className="font-mono text-xs break-all">{detail.business.provider_place_id}</span>,
    },
    {
      key: "fetchedAt",
      label: t("detail.info.fetchedAt"),
      value: <TextValue value={formatDateTime(snapshot?.fetched_at ?? null, locale)} />,
      hint: snapshot?.expires_at ? `${t("detail.info.expiresAt")}: ${formatDateTime(snapshot.expires_at, locale) ?? tc("states.unknown")}` : undefined,
    },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <KeyValueList items={items} />

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("detail.info.contacts")}</h3>
        {detail.contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("detail.info.noContacts")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {detail.contacts.map((contact) => (
              <li key={contact.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline" className="font-normal">
                  {CONTACT_TYPES.has(contact.type) ? t(`detail.info.contactType.${contact.type}`) : contact.type}
                </Badge>
                <span className="break-all">{contact.value}</span>
                <span className="text-xs text-muted-foreground">
                  {CONTACT_SOURCES.has(contact.source) ? t(`detail.info.contactSource.${contact.source}`) : contact.source}
                </span>
                <ConfidenceBadge confidence={contact.confidence} withLabel />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
