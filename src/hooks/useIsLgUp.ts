"use client";

import { useEffect, useState } from "react";

const LG_QUERY = "(min-width: 1024px)";

/** true jika viewport >= Tailwind `lg` (1024px). */
export function useIsLgUp(): boolean {
  const [isLg, setIsLg] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(LG_QUERY);
    const update = () => setIsLg(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isLg;
}
