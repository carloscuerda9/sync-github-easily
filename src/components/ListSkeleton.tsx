import { Skeleton } from "@/components/ui/skeleton";

interface ListSkeletonProps {
  rows?: number;
}

/** Reusable loading placeholder for list/card data. */
export function ListSkeleton({ rows = 4 }: ListSkeletonProps) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
