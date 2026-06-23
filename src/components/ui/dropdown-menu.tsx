"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { cn } from "@/lib/utils";

// ─── React Context ────────────────────────────────────────────────────────────

interface DropdownMenuContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
}

const DropdownMenuContext = createContext<DropdownMenuContextType | undefined>(
  undefined
);

// ─── Main Provider: DropdownMenu ──────────────────────────────────────────────

export function DropdownMenu({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Deteksi klik di luar komponen untuk menutup dropdown secara otomatis
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        triggerRef.current &&
        triggerRef.current.contains(event.target as Node)
      ) {
        return;
      }
      if (
        contentRef.current &&
        !contentRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <DropdownMenuContext.Provider
      value={{ isOpen, setIsOpen, triggerRef, contentRef }}
    >
      <div className="relative inline-block text-left">{children}</div>
    </DropdownMenuContext.Provider>
  );
}

// ─── Trigger Button: DropdownMenuTrigger ──────────────────────────────────────

interface DropdownMenuTriggerProps {
  children: React.ReactElement;
  asChild?: boolean;
}

export function DropdownMenuTrigger({
  children,
  asChild = true,
}: DropdownMenuTriggerProps) {
  const context = useContext(DropdownMenuContext);
  if (!context) {
    throw new Error("DropdownMenuTrigger harus digunakan di dalam DropdownMenu");
  }

  const { isOpen, setIsOpen, triggerRef } = context;

  const toggleDropdown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  // Meng-clone child untuk menginjeksikan ref dan event handler onClick secara aman
  return (
    <div ref={triggerRef as any} className="inline-flex w-full" onClick={toggleDropdown}>
      {React.cloneElement(children, {
        "aria-haspopup": "true",
        "aria-expanded": isOpen,
      } as any)}
    </div>
  );
}

// ─── Dropdown Content Wrapper: DropdownMenuContent ────────────────────────────

interface DropdownMenuContentProps {
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
}

export function DropdownMenuContent({
  children,
  align = "end",
  className,
}: DropdownMenuContentProps) {
  const context = useContext(DropdownMenuContext);
  if (!context) {
    throw new Error("DropdownMenuContent harus digunakan di dalam DropdownMenu");
  }

  const { isOpen, contentRef } = context;

  if (!isOpen) return null;

  return (
    <div
      ref={contentRef as any}
      className={cn(
        "absolute mt-2 w-48 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md z-50 focus:outline-hidden",
        "animate-in fade-in-80 slide-in-from-top-1 duration-100",
        align === "end" ? "right-0 origin-top-right" : "left-0 origin-top-left",
        className
      )}
      role="menu"
    >
      {children}
    </div>
  );
}

// ─── Individual Menu Item: DropdownMenuItem ───────────────────────────────────

interface DropdownMenuItemProps {
  children: ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  disabled?: boolean;
}

export function DropdownMenuItem({
  children,
  onClick,
  className,
  disabled = false,
}: DropdownMenuItemProps) {
  const context = useContext(DropdownMenuContext);
  if (!context) {
    throw new Error("DropdownMenuItem harus digunakan di dalam DropdownMenu");
  }

  const { setIsOpen } = context;

  const handleClick = (e: React.MouseEvent) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    if (onClick) {
      onClick(e);
    }
    setIsOpen(false); // Otomatis tutup dropdown setelah menu diklik
  };

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs md:text-sm outline-hidden transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "disabled:pointer-events-none disabled:opacity-50",
        "text-left gap-2",
        className
      )}
    >
      {children}
    </button>
  );
}
