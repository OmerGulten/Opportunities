"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ServiceIcon } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { updateWorkspaceServices } from "@/features/settings/actions";
import { useT } from "@/lib/i18n/client";

export interface WorkspaceServiceOption {
  id: string;
  key: string;
  /** Already localized by the server component. */
  name: string;
  description: string | null;
  icon: string | null;
  enabled: boolean;
}

export interface ServicesFormProps {
  services: WorkspaceServiceOption[];
  canEdit: boolean;
}

/**
 * Which services this workspace sells. Scoring only runs for services that are
 * on, so the copy says that plainly rather than treating this as a preference.
 */
export function ServicesForm({ services, canEdit }: ServicesFormProps) {
  const t = useT("services");
  const tc = useT("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [selected, setSelected] = useState<string[]>(() => services.filter((service) => service.enabled).map((service) => service.id));
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string, next: boolean) {
    setSelected((current) => (next ? [...current.filter((value) => value !== id), id] : current.filter((value) => value !== id)));
    setError(null);
  }

  function submit() {
    if (selected.length === 0) {
      setError(t("selection.atLeastOne"));
      return;
    }
    startTransition(async () => {
      const result = await updateWorkspaceServices({ serviceIds: selected });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t("selection.saved"));
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("selection.title")}</CardTitle>
        <CardDescription>{t("selection.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {services.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("selection.empty")}</p>
        ) : (
          services.map((service) => {
            const isOn = selected.includes(service.id);
            return (
              <Item key={service.id} variant="outline">
                <ItemMedia variant="icon">
                  <ServiceIcon icon={service.icon} colored={isOn} />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{service.name}</ItemTitle>
                  {service.description ? <ItemDescription>{service.description}</ItemDescription> : null}
                </ItemContent>
                <ItemActions className="gap-2">
                  <span className="text-xs text-muted-foreground">{isOn ? t("selection.enabled") : t("selection.disabled")}</span>
                  <Switch
                    checked={isOn}
                    disabled={!canEdit || pending}
                    aria-label={service.name}
                    onCheckedChange={(checked) => toggle(service.id, checked === true)}
                  />
                </ItemActions>
              </Item>
            );
          })
        )}
        {error ? <FieldError>{error}</FieldError> : null}
        <p className="text-xs text-muted-foreground">{t("disabledNotice")}</p>
      </CardContent>
      {canEdit ? (
        <CardFooter className="justify-between gap-2">
          <span className="text-xs text-muted-foreground">{t("selection.selectedCount", { count: selected.length })}</span>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Spinner /> : null}
            {tc("actions.save")}
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}
