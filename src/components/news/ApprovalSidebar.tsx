"use client";

import { useEffect, useRef, RefObject } from "react";
import { cn } from "@/lib/utils";
import ArticleApprovalForm from "./ArticleApprovalForm";
import { Article } from "@/types/article";

// ─── Custom Hook: Bidirectional Sticky ────────────────────────────────────────

/**
 * Hook untuk membuat elemen sticky dua arah (bidirectional sticky).
 * 
 * Perilaku:
 * - Sidebar lebih pendek dari viewport  → langsung sticky di bagian atas dengan jarak `offsetTop`.
 * - Sidebar lebih panjang dari viewport:
 *   - Scroll ke bawah → sidebar ikut scroll sampai bagian bawahnya mentok viewport, lalu berhenti.
 *   - Scroll ke atas  → sidebar ikut scroll kembali ke atas sampai bagian atasnya mentok, lalu berhenti.
 * 
 * @param offsetTop    - Jarak dari atas viewport saat sidebar mentok atas (px). Default 128 ≈ pt-32.
 * @param offsetBottom - Jarak dari bawah viewport saat sidebar mentok bawah (px). Default 24.
 */
function useBidirectionalSticky(
  offsetTop = 128,
  offsetBottom = 24,
  enabled = true,
) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let currentTop = offsetTop;
    let lastScrollY = window.scrollY;

    el.style.position = "sticky";
    el.style.top = `${currentTop}px`;

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const scrollDiff = scrollY - lastScrollY;
      lastScrollY = scrollY;

      if (scrollDiff === 0 || !enabled) return;

      const elHeight = el.offsetHeight;
      const viewportHeight = window.innerHeight;

      if (elHeight + offsetTop + offsetBottom <= viewportHeight) {
        currentTop = offsetTop;
        el.style.top = `${currentTop}px`;
        return;
      }

      const minTop = viewportHeight - elHeight - offsetBottom;

      if (scrollDiff > 0) {
        currentTop = Math.max(currentTop - scrollDiff, minTop);
      } else {
        currentTop = Math.min(currentTop - scrollDiff, offsetTop);
      }

      el.style.top = `${currentTop}px`;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [offsetTop, offsetBottom, enabled]);

  return ref as RefObject<HTMLElement>;
}

// ─── Approval Sidebar Component ───────────────────────────────────────────────

interface ApprovalSidebarProps {
  article: Article;
  userRole: string;
  onSuccess?: () => void;
  className?: string;
}

/**
 * Sidebar approval untuk halaman single article approval.
 * Sticky bidirectional, hanya muncul di desktop (≥lg).
 */
export default function ApprovalSidebar({
  article,
  userRole,
  onSuccess,
  className,
}: ApprovalSidebarProps) {
  // offsetTop = 96px (navbar height + spacing)
  // offsetBottom = 24px
  const sidebarRef = useBidirectionalSticky(96, 24, true);

  return (
    <aside
      ref={sidebarRef}
      className={cn(
        "hidden lg:block w-80 flex-shrink-0 self-start",
        className,
      )}
    >
      <ArticleApprovalForm
        article={article}
        userRole={userRole}
        onSuccess={onSuccess}
        isSidebar={true}
      />
    </aside>
  );
}
