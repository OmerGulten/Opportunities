import { Skeleton } from "@/components/ui/skeleton";

/** Board-shaped skeleton so the layout does not jump when the data lands. */
export default function PipelineLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <Skeleton className="h-20 rounded-xl" />

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-32" />
      </div>

      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }, (_, column) => (
          <div key={column} className="flex w-72 shrink-0 flex-col gap-3 rounded-xl bg-muted/40 p-3">
            <Skeleton className="h-4 w-28" />
            {Array.from({ length: column % 2 === 0 ? 3 : 2 }, (__, card) => (
              <Skeleton key={card} className="h-36 rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
