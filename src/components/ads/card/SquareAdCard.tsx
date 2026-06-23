import BaseAdCard from "./BaseAdCard";

export interface SquareAdCardProps {
  src?: string;
  alt?: string;
  className?: string;
}

export default function SquareAdCard(props: SquareAdCardProps) {
  return (
    <BaseAdCard
      width={300}
      height={300}
      defaultSrc="/ads-banner/Banner-300x300.png"
      {...props}
    />
  );
}
