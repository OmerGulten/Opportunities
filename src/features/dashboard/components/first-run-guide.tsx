import { FileSearch, Handshake, Radar, Sparkles, SquarePlus, Target } from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export interface FirstRunStep {
  key: string;
  title: string;
  description: string;
}

export interface FirstRunGuideProps {
  title: string;
  description: string;
  action: string;
  steps: FirstRunStep[];
}

const icons: Record<string, ComponentType<{ className?: string }>> = {
  discover: Radar,
  audit: FileSearch,
  score: Target,
  outreach: Sparkles,
  pipeline: Handshake,
};

/**
 * Shown until the workspace has run its first scan. It explains the loop rather
 * than showing five empty charts, and points at the one action that starts it.
 */
export function FirstRunGuide({ title, description, action, steps }: FirstRunGuideProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="max-w-2xl space-y-1">
          <h2 className="font-heading text-lg font-semibold tracking-tight text-balance">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {steps.map((step) => {
            const Icon = icons[step.key] ?? Sparkles;
            return (
              <li key={step.key} className="flex flex-col gap-2 rounded-xl bg-muted/40 p-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                <span className="text-sm font-medium">{step.title}</span>
                <span className="text-xs leading-relaxed text-muted-foreground">{step.description}</span>
              </li>
            );
          })}
        </ol>

        <div>
          <Button render={<Link href="/scans/new" />}>
            <SquarePlus />
            {action}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
