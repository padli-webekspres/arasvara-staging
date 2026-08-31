"use client";

import Link from "next/link";
import { FOOTER_MORE } from "@/lib/constants";

/** Overlay menu tanpa Vaul — dipakai jika chunk drawer gagal di-load. */
export default function NavbarMenuFallback({
  onClose,
}: {
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-100 bg-background/95 p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
    >
      <button
        type="button"
        className="mb-6 text-sm font-medium text-foreground underline-offset-4 hover:underline"
        onClick={onClose}
      >
        Tutup
      </button>
      <nav className="flex flex-col gap-3">
        {FOOTER_MORE.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-lg font-semibold text-foreground hover:text-hijauSawah"
            onClick={onClose}
          >
            {item.name}
          </Link>
        ))}
      </nav>
    </div>
  );
}
