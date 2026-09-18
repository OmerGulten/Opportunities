import { Skeleton } from "@/components/ui/skeleton";

/** Streaming placeholder for the business profile. */
export default function BusinessDetailLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex flex-col gap-3">
              <Skeleton className="h-5 w-52" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-6">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex flex-col gap-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
