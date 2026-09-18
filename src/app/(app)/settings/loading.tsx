import { Skeleton } from "@/components/ui/skeleton";

/** Fallback for a settings section: two stacked cards with a few fields. */
export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      {Array.from({ length: 2 }, (_, card) => (
        <div key={card} className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }, (_, field) => (
              <div key={field} className="flex flex-col gap-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-8 w-full max-w-md" />
              </div>
            ))}
          </div>
          <Skeleton className="h-8 w-24 self-end" />
        </div>
      ))}
    </div>
  );
}
