import BaseAdCard from "./BaseAdCard";

export interface HorizontalAdCardProps {
  src?: string;
  alt?: string;
  className?: string;
}

export default function HorizontalAdCard(props: HorizontalAdCardProps) {
  return (
    <BaseAdCard
      width={970}
      height={250}
      defaultSrc="/ads-banner/Banner-970x250.png"
      {...props}
    />
  );
}
