"use client";

import { useConfiguration } from "@/hooks/useConfiguration";
import FooterView from "./FooterView";
import { footerViewPropsFromConfigs } from "@/lib/footer-view-props";

/** Footer client — dipakai about-us yang sudah di dalam Client Component. */
export default function Footer() {
  const { data, isLoading } = useConfiguration();
  const props = footerViewPropsFromConfigs(data ?? []);

  return <FooterView {...props} isLoading={isLoading} />;
}
