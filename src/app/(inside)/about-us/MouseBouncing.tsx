import { Mouse } from "lucide-react";

interface MouseBouncingProps {
  variant?: "light" | "dark";
}

const MouseBouncing = ({ variant = "light" }: MouseBouncingProps) => {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-16 z-50 md:flex justify-center hidden ">
      <Mouse
        className={`size-10 ${variant === "light" ? "text-background/75" : "text-foreground/50"} animate-bounce animation-duration-[2.5s]`}
      />
    </div>
  );
};

export default MouseBouncing;
