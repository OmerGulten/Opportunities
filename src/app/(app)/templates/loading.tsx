import { Skeleton } from "@/components/ui/skeleton";

/** Template list skeleton: header, filter row, two groups of cards. */
export default function TemplatesLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>

      <Skeleton className="h-16 rounded-xl" />

      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-14 w-56" />
        <Skeleton className="h-14 w-40" />
        <Skeleton className="h-14 w-48" />
      </div>

      {Array.from({ length: 2 }, (_, group) => (
        <div key={group} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-48" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, card) => (
              <Skeleton key={card} className="h-56 rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
