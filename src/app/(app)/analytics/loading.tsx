import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the analytics layout: header, filter bar, stat rows and charts. */
export default function AnalyticsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-full max-w-xl" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />

      {Array.from({ length: 2 }, (_, section) => (
        <div key={section} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-24 rounded-xl" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}
