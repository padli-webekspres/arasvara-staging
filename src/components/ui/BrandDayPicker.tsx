"use client";

import type { ComponentProps } from "react";
import { DayPicker } from "react-day-picker";
import { DAY_PICKER_BRAND_STYLE } from "@/lib/day-picker-brand";
import "react-day-picker/style.css";
import "./brand-day-picker.css";

const BRAND_GREEN = "#445f24";

function BrandChevron({
  className,
  orientation = "left",
  size = 24,
}: {
  className?: string;
  orientation?: "up" | "down" | "left" | "right";
  size?: number;
  disabled?: boolean;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ fill: BRAND_GREEN }}
    >
      {orientation === "up" && (
        <polygon points="6.77 17 12.5 11.43 18.24 17 20 15.28 12.5 8 5 15.28" />
      )}
      {orientation === "down" && (
        <polygon points="6.77 8 12.5 13.57 18.24 8 20 9.72 12.5 17 5 9.72" />
      )}
      {orientation === "left" && (
        <polygon points="16 18.112 9.81111111 12 16 5.87733333 14.0888889 4 6 12 14.0888889 20" />
      )}
      {orientation === "right" && (
        <polygon points="8 18.112 14.18888889 12 8 5.87733333 9.91111111 4 18 12 9.91111111 20" />
      )}
    </svg>
  );
}

/** DayPicker dengan aksen hijau sawah — CSS paket default-nya biru. */
export function BrandDayPicker(props: ComponentProps<typeof DayPicker>) {
  const { style, components, modifiersStyles, ...rest } = props;

  return (
    <DayPicker
      {...rest}
      style={{ ...DAY_PICKER_BRAND_STYLE, ...style }}
      modifiersStyles={{
        today: { color: BRAND_GREEN },
        ...modifiersStyles,
      }}
      components={{
        ...components,
        Chevron: BrandChevron,
      }}
    />
  );
}
