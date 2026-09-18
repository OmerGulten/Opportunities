import { Skeleton } from "@/components/ui/skeleton";

/** Fallback while an admin section streams in. Mirrors the header + KPI + table rhythm. */
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="space-y-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
