"use client";

import { cn } from "@/lib/utils";
import { AlertCircle, Info, AlertTriangle } from "lucide-react";

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "warning" | "success" | "danger";
  className?: string;
}) {
  const valueClass =
    tone === "warning"
      ? "text-terakota"
      : tone === "success"
        ? "text-hijauSawah"
        : tone === "danger"
          ? "text-destructive"
          : "text-foreground";

  return (
    <div
      className={cn(
        "bg-card text-card-foreground border border-border rounded-lg shadow-xs p-4 sm:p-5 flex flex-col gap-1 min-w-0",
        className,
      )}
    >
      <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <div className={cn("text-2xl sm:text-3xl font-bold tracking-tight", valueClass)}>
        {value}
      </div>
      {hint ? (
        <div className="text-xs text-muted-foreground leading-snug">{hint}</div>
      ) : null}
    </div>
  );
}

export type AlertItem = {
  type: string;
  severity: "info" | "warning" | "critical";
  message: string;
};

export function AlertRail({
  alerts,
  className,
}: {
  alerts: AlertItem[];
  className?: string;
}) {
  if (!alerts?.length) return null;
  return (
    <div className={cn("space-y-2", className)} role="status" aria-live="polite">
      {alerts.map((alert, idx) => {
        const Icon =
          alert.severity === "critical"
            ? AlertCircle
            : alert.severity === "warning"
              ? AlertTriangle
              : Info;
        const tone =
          alert.severity === "critical"
            ? "border-destructive/40 bg-destructive/5 text-destructive"
            : alert.severity === "warning"
              ? "border-terakota/40 bg-terakota/5 text-terakota"
              : "border-border bg-muted/40 text-foreground";
        return (
          <div
            key={`${alert.type}-${idx}`}
            className={cn(
              "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
              tone,
            )}
          >
            <Icon className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
            <p className="min-w-0 leading-snug">{alert.message}</p>
          </div>
        );
      })}
    </div>
  );
}

export function TargetUnsetBadge({
  className,
  label = "Target individual belum diset",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function ChartState({
  loading,
  error,
  empty,
  emptyText = "Tidak ada data",
  onRetry,
  children,
  className,
}: {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyText?: string;
  onRetry?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  if (loading) {
    return (
      <div
        className={cn(
          "h-[220px] sm:h-[280px] animate-pulse rounded-md bg-muted/40",
          className,
        )}
        aria-busy="true"
        aria-label="Memuat grafik"
      />
    );
  }
  if (error) {
    return (
      <div
        className={cn(
          "h-[220px] sm:h-[280px] flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground",
          className,
        )}
      >
        <p className="text-destructive text-center px-4">{error}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs underline underline-offset-2 hover:text-foreground"
          >
            Coba lagi
          </button>
        ) : null}
      </div>
    );
  }
  if (empty) {
    return (
      <div
        className={cn(
          "h-[220px] sm:h-[280px] flex items-center justify-center text-xs text-muted-foreground",
          className,
        )}
      >
        {emptyText}
      </div>
    );
  }
  return <div className={cn("min-w-0", className)}>{children}</div>;
}

export function formatMom(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

/** Alias for equal-length previous window (7d/30d), not calendar MoM. */
export function formatVsPrevPeriod(value: number | null | undefined): string {
  return formatMom(value);
}
