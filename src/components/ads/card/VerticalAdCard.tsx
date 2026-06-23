import { useHomepageAdsGrouped } from "@/hooks/useAds";
import BaseAdCard from "./BaseAdCard";

export interface VerticalAdCardProps {
  src?: string;
  alt?: string;
  className?: string;
  /** Isi penuh wrapper (rasio ditentukan oleh parent), misalnya di samping HeroCard. */
  fill?: boolean;
}

export default function VerticalAdCard({
  fill,
  ...props
}: VerticalAdCardProps) {
  const { isLoading: isLoadingAds, featuredAds } = useHomepageAdsGrouped();
  return (
    <BaseAdCard
      width={300}
      height={600}
      defaultSrc={
        featuredAds[0]?.banner.url || "/ads-banner/Banner-300x600.png"
      }
      fill={fill}
      {...props}
    />
  );
}
