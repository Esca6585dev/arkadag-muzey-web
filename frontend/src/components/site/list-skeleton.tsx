import { Skeleton } from "@/components/ui/skeleton";

export function ListSkeleton({ cols = 3, count = 6, aspect = "aspect-[16/10]" }: { cols?: 2 | 3 | 4; count?: number; aspect?: string }) {
  const grid = cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : cols === 2 ? "md:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <div aria-busy="true">
      <div className="-mt-[var(--header-height)] bg-sidebar pt-[var(--header-height)]">
        <div className="container-x py-20 md:py-28">
          <Skeleton className="h-12 w-2/3 max-w-md bg-white/10" />
          <Skeleton className="mt-5 h-5 w-1/2 max-w-lg bg-white/10" />
        </div>
      </div>
      <div className="container-x section">
        <div className="mb-8 flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
        <div className={`grid gap-6 ${grid}`}>
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className={`${aspect} w-full rounded-2xl`} />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
