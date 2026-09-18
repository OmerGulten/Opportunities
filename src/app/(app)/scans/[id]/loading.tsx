import { Skeleton } from "@/components/ui/skeleton";

/** Detail-shaped skeleton: header, live progress, coverage map, tables. */
export default function ScanDetailLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-8 w-44" />
        </div>
      </div>
      <Skeleton className="h-36 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-96 rounded-xl lg:col-span-2" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
