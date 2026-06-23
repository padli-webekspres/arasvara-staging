import BaseAdCard from "./BaseAdCard";

export interface HorizontalLongAdsProps {
  width?: string | number; // Backward compatibility
  height?: string | number; // Backward compatibility
  className?: string;
  src?: string;
  alt?: string;
}

export default function HorizontalLongAds(props: HorizontalLongAdsProps) {
  return (
    <BaseAdCard
      width={728}
      height={90}
      defaultSrc="/ads-banner/Banner-728x90.png"
      src={props.src}
      alt={props.alt}
      className={props.className}
    />
  );
}
