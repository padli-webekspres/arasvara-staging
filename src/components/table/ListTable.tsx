import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface ListTableColumn<T> {
  key: keyof T | string;
  header: React.ReactNode;
render?: (row: T, idx: number) => React.ReactNode;
  className?: string;
}

export interface ListTableProps<T> {
  columns: ListTableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyText?: string;
  rowKey?: (row: T, idx: number) => string | number;
  className?: string;
  /** Extra classes on the table element */
  tableClassName?: string;
  /** Tighter cell padding on mobile (p-2 sm:p-4) */
  compact?: boolean;
  /** Jumlah baris skeleton saat loading */
  skeletonRows?: number;
}

/** Apply `className: "hidden md:table-cell"` (or lg) on columns to hide on smaller screens */
const headerCellDefault =
  "text-left align-middle p-4 font-medium text-foreground";
const bodyCellDefault = "text-left align-middle p-4";
const headerCellCompact =
  "text-left align-middle p-2 sm:p-4 font-medium text-foreground";
const bodyCellCompact = "text-left align-middle p-2 sm:p-4";

function LoadingSkeletonRows({
  columns,
  skeletonRows,
  bodyCell,
}: {
  columns: ListTableColumn<unknown>[];
  skeletonRows: number;
  bodyCell: string;
}) {
  return (
    <>
      {Array.from({ length: skeletonRows }).map((_, rowIdx) => (
        <tr
          key={`list-table-skeleton-${rowIdx}`}
          className="border-b border-border hover:bg-transparent"
        >
          {columns.map((col, colIdx) => {
            const isFirst = colIdx === 0;
            const isLast = colIdx === columns.length - 1;

            return (
              <td key={colIdx} className={cn(bodyCell, col.className)}>
                {isLast ? (
                  <div className="flex items-center justify-start gap-2">
                    <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
                    <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
                    <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
                  </div>
                ) : isFirst ? (
                  <div className="space-y-2 max-w-xs text-left">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-4/5" />
                  </div>
                ) : (
                  <Skeleton className="h-4 w-24 max-w-full" />
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

export function ListTable<T extends object>({
  columns,
  data,
  loading = false,
  emptyText = "No data found",
  rowKey,
  className = "",
  tableClassName,
  compact = false,
  skeletonRows = 5,
}: ListTableProps<T>) {
  const headerCell = compact ? headerCellCompact : headerCellDefault;
  const bodyCell = compact ? bodyCellCompact : bodyCellDefault;

  return (
    <div className="relative">
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none z-10 md:hidden" />
      <div className={cn("overflow-x-auto", className)}>
      <table className={cn("w-full border-collapse text-left", tableClassName)}>
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {columns.map((col, i) => {
              const isSticky = col.className?.includes('sticky');
              return (
                <th 
                  key={i} 
                  className={cn(
                    headerCell, 
                    col.className,
                    isSticky && 'z-30'
                  )}
                >
                  {col.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <LoadingSkeletonRows
              columns={columns as ListTableColumn<unknown>[]}
              skeletonRows={skeletonRows}
              bodyCell={bodyCell}
            />
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className={cn(bodyCell, "text-center text-muted-foreground")}
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr
                key={rowKey ? rowKey(row, idx) : idx}
                className="border-b border-border hover:bg-muted/30"
              >
                {columns.map((col, colIdx) => {
                  const isSticky = col.className?.includes('sticky');
                  return (
                    <td 
                      key={colIdx} 
                      className={cn(
                        bodyCell, 
                        col.className,
                        isSticky && 'z-20'
                      )}
                    >
                      {col.render
                        ? col.render(row, idx)
                        : typeof col.key === "string"
                          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            (row as any)[col.key]
                          : row[col.key as keyof T]}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
    </div>
  );
}
