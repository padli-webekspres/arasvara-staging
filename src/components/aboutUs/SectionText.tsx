import MouseBouncing from "@/app/(inside)/about-us/MouseBouncing";
import { cn } from "@/lib/utils";

export interface SectionTextProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  variant?: "light" | "dark";
  /**
   * Ketika `true`, section menjadi tepat satu viewport tingginya (`h-screen`)
   * dan mendapat class `snap-panel` agar bisa masuk zona GSAP snap scroll.
   * Padding vertikal (`py-16 lg:py-24`) diganti dengan `overflow-hidden`
   * supaya konten tidak keluar dari viewport.
   */
  snapPanel?: boolean;
  hideIconMouseBouncing?: boolean;
}

export default function SectionText({
  title,
  children,
  className,
  variant = "light",
  snapPanel = false,
  hideIconMouseBouncing = false,
}: SectionTextProps) {
  return (
    <section
      className={cn(
        "flex items-center relative",
        snapPanel ? "h-screen snap-panel overflow-hidden" : "py-16 lg:py-24",
        variant === "light" ? "bg-background" : "bg-foreground",
        className,
      )}
    >
      <div className="container xl:max-w-6xl relative flex flex-col md:flex-row mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8 gap-8">
        <h2
          className={cn(
            "text-3xl md:text-4xl lg:text-5xl font-bold w-full md:w-1/3",
            variant === "light" ? "text-primary" : "text-background",
          )}
        >
          {title}
        </h2>
        <div className="w-full md:w-2/3 space-y-2">{children}</div>
      </div>
      {!hideIconMouseBouncing && (
        <MouseBouncing variant={variant == "dark" ? "light" : "dark"} />
      )}
    </section>
  );
}
