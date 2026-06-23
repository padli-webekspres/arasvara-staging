import BaseAdCard from "./BaseAdCard";

export interface VerticalLongAdCardProps {
  src?: string;
  alt?: string;
  className?: string;
}

export default function VerticalLongAdCard(props: VerticalLongAdCardProps) {
  return (
    <BaseAdCard
      width={160}
      height={600}
      defaultSrc="/ads-banner/Banner-160x600.png"
      {...props}
    />
  );
}
