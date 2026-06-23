/**
 * Skeleton Components
 * Digunakan untuk menunjukkan loading state pada berbagai elemen UI
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

export function SkeletonText({ lines = 1 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}

export function SkeletonAvatar() {
  return <Skeleton className="h-9 w-9 rounded-full" />;
}

export function SkeletonTableRow({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          {i === 0 ? (
            <div className="flex items-center gap-3">
              <SkeletonAvatar />
              <div className="flex-1">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ) : (
            <Skeleton className="h-4 w-16" />
          )}
        </td>
      ))}
    </tr>
  );
}
