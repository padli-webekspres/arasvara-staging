"use client";

import { cn } from "@/lib/utils";
import React from "react";

interface DividerHorizontalProps {
  variant?: "dark" | "light";
  /** `compact`: tanpa container/padding besar; untuk sidebar dsb. */
  density?: "default" | "compact";
  className?: string;
}

const DividerHorizontal = ({
  variant = "dark",
  density = "default",
  className,
}: DividerHorizontalProps) => {
  const compact = density === "compact";

  return (
    <div
      className={cn(
        !compact && "container mx-auto px-4",
        compact && "w-full",
        className,
      )}
    >
      <span
        className={cn(
          "block w-full h-0.5",
          variant === "dark" ? "bg-primary/10" : "bg-white/20",
          compact ? "my-2" : "my-8",
        )}
      />
    </div>
  );
};

export default DividerHorizontal;
