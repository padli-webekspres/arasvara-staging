"use client";

import { useSnapScroll } from "@/hooks/animation/useSnapScrollHomepage";
import React from "react";

export default function SnapWrapperBottom({
  children,
}: {
  children: React.ReactNode;
}) {
  const wrapperRef = useSnapScroll();

  return (
    <div ref={wrapperRef} className="w-full relative">
      {children}
    </div>
  );
}
