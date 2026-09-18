import { Skeleton } from "@/components/ui/skeleton";

/** Shell-level fallback while a route segment streams in. */
export default function AppLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
