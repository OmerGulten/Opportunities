"use client";

import { AlarmClock, KanbanSquare, List, Search, X } from "lucide-react";
import { parseAsBoolean, parseAsString, parseAsStringLiteral, useQueryState, useQueryStates } from "nuqs";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/lib/i18n/client";

import { PIPELINE_VIEWS, type PipelineOwnerModel } from "./types";

const ALL = "all";
const UNASSIGNED = "unassigned";
const STATUSES = ["open", "won", "lost", "archived"] as const;

/**
 * Filters live in the URL so a filtered board can be shared and survives
 * navigating away and back. Filter changes re-run the server component
 * (`shallow: false`); the board/list switch stays on the client.
 */
export function PipelineToolbar({ owners }: { owners: PipelineOwnerModel[] }) {
  const t = useT("pipeline");
  const tc = useT("common");
  const [pending, startTransition] = useTransition();

  const [view, setView] = useQueryState("view", parseAsStringLiteral(PIPELINE_VIEWS).withDefault("board").withOptions({ clearOnDefault: true }));

  const [filters, setFilters] = useQueryStates(
    {
      q: parseAsString.withDefault(""),
      owner: parseAsString.withDefault(ALL),
      status: parseAsString.withDefault(ALL),
      due: parseAsBoolean.withDefault(false),
    },
    { shallow: false, clearOnDefault: true, startTransition },
  );

  const activeCount = [filters.q.trim() !== "", filters.owner !== ALL, filters.status !== ALL, filters.due].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={filters.q}
            aria-label={t("filters.search")}
            placeholder={t("filters.searchPlaceholder")}
            className="h-8 w-56 pl-8"
            onChange={(event) => void setFilters({ q: event.target.value || null }, { throttleMs: 400 })}
          />
        </div>

        <Select
          value={filters.owner}
          onValueChange={(value) => {
            if (typeof value === "string") void setFilters({ owner: value === ALL ? null : value });
          }}
        >
          <SelectTrigger size="sm" className="min-w-40" aria-label={t("filters.owner")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filters.allOwners")}</SelectItem>
            <SelectItem value={UNASSIGNED}>{t("filters.unassigned")}</SelectItem>
            {owners.map((owner) => (
              <SelectItem key={owner.id} value={owner.id}>
                {owner.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(value) => {
            if (typeof value === "string") void setFilters({ status: value === ALL ? null : value });
          }}
        >
          <SelectTrigger size="sm" className="min-w-36" aria-label={t("filters.status")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filters.allStatuses")}</SelectItem>
            {STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {t(`status.${status}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={filters.due ? "secondary" : "outline"}
          size="sm"
          aria-pressed={filters.due}
          onClick={() => void setFilters({ due: filters.due ? null : true })}
        >
          <AlarmClock />
          {t("filters.dueOnly")}
        </Button>

        {activeCount > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void setFilters({ q: null, owner: null, status: null, due: null })}
          >
            <X />
            {t("filters.clear")}
          </Button>
        ) : null}

        {pending ? <Spinner className="text-muted-foreground" aria-label={tc("states.loading")} /> : null}
      </div>

      <div className="flex items-center gap-1 self-start rounded-lg bg-muted/60 p-0.5" role="group" aria-label={t("view.label")}>
        <Button
          variant={view === "board" ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={view === "board"}
          onClick={() => void setView("board")}
        >
          <KanbanSquare />
          {t("view.board")}
        </Button>
        <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" aria-pressed={view === "list"} onClick={() => void setView("list")}>
          <List />
          {t("view.list")}
        </Button>
      </div>
    </div>
  );
}
