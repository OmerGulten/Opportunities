import { Skeleton } from "@/components/ui/skeleton";

/** Streaming placeholder for the business list: header, filter bar, table. */
export default function BusinessesLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-full max-w-xs" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="ml-auto h-8 w-32" />
      </div>
      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <Skeleton className="h-10 w-full rounded-none" />
        <div className="flex flex-col gap-px p-3">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="flex items-center gap-4 py-2">
              <Skeleton className="h-4 flex-1 max-w-56" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="h-8 w-full max-w-sm self-end" />
    </div>
  );
}
