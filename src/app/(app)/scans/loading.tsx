import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton for the scans segment (list, wizard and detail share this boundary). */
export default function ScansLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex items-end justify-between gap-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-52" />
      </div>
      <div className="flex flex-col gap-2 rounded-xl p-4 ring-1 ring-foreground/10">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-center gap-4 py-2">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="hidden h-9 w-40 sm:block" />
            <Skeleton className="hidden h-9 w-32 lg:block" />
            <Skeleton className="h-9 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
