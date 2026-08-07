import { cn } from "@/lib/utils";
import Link from "next/link";

interface TitleHomepageProps {
  title: string;
  seeMoreLink?: string;
  className?: string;
  variant?: "light" | "dark";
}
const TitleHomepage: React.FC<TitleHomepageProps> = ({
  title,
  seeMoreLink,
  className,
  variant = "light",
}) => {
  return (
    <div
      className={cn(
        `flex items-center justify-between mb-4 md:mb-6  flex-col md:flex-row ${className}`,
      )}
    >
      <h2
        className={cn(
          "text-3xl lg:text-4xl font-bold text-center w-full md:w-auto",
          {
            "text-white": variant === "dark",
            "text-primary": variant === "light",
          },
        )}
      >
        {title}
      </h2>
      {seeMoreLink && (
        <Link
          href={seeMoreLink}
          className={cn(
            " text-lg transition-all hover:font-semibold ",
            variant === "light" ? "text-hijauSawah" : "text-white",
          )}
        >
          Lihat Semua
        </Link>
      )}
    </div>
  );
};

export default TitleHomepage;
