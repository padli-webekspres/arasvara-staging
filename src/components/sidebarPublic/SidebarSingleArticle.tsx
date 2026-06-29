"use client";

import { useEffect, useRef, RefObject, useCallback } from "react";
import Link from "next/link";
import { ArticleListResponse } from "@/types/article";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useHeadlineArticles,
  usePopularArticles,
} from "@/hooks/useSectionArticles";
import { useGridSection } from "@/hooks/useSectionsHomepage";
import { useEditorChoices } from "@/hooks/useEditorChoices";
import { SectionArticleItem } from "@/types/articleSection";
import { cn } from "@/lib/utils";
import { resolvePublicArticleHref } from "@/lib/article-public-path";
import { ADS_CARD_DEFAULT_BANNER } from "@/types/ads";
import { trackAdClick } from "@/lib/trackAdClick";
import { trackSelectContent, trackGaAdClick } from "@/lib/ga-events";
import { useAdImpressionTracking } from "@/hooks/useAdImpressionTracking";
import BaseAdCard from "../ads/card/BaseAdCard";

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
 * Cara kerja:
 * - Elemen di-set `position: sticky`.
 * - Nilai `top` digeser secara dinamis sesuai arah dan jumlah scroll.
 * - `top` dibatasi antara `minTop` (mentok bawah) dan `offsetTop` (mentok atas).
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

    // currentTop menyimpan nilai `top` yang sedang aktif (dalam px)
    let currentTop = offsetTop;
    let lastScrollY = window.scrollY;

    // Set initial position
    el.style.position = "sticky";
    el.style.top = `${currentTop}px`;

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const scrollDiff = scrollY - lastScrollY;
      lastScrollY = scrollY;

      if (scrollDiff === 0 || !enabled) return;

      const elHeight = el.offsetHeight;
      const viewportHeight = window.innerHeight;

      // Jika sidebar muat di viewport, tidak perlu bidirectional — cukup sticky atas
      if (elHeight + offsetTop + offsetBottom <= viewportHeight) {
        currentTop = offsetTop;
        el.style.top = `${currentTop}px`;
        return;
      }

      // Batas bawah: posisi top minimum agar bawah sidebar tepat mentok viewport
      const minTop = viewportHeight - elHeight - offsetBottom;

      if (scrollDiff > 0) {
        // Scroll ke bawah: geser top ke atas (kurangi nilai top)
        currentTop = Math.max(currentTop - scrollDiff, minTop);
      } else {
        // Scroll ke atas: geser top ke bawah (tambah nilai top), tapi jangan melebihi offsetTop
        currentTop = Math.min(currentTop - scrollDiff, offsetTop);
      }

      el.style.top = `${currentTop}px`;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    // Jalankan sekali di awal untuk menentukan posisi awal yang benar
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [offsetTop, offsetBottom, enabled]);

  return ref as RefObject<HTMLElement>;
}

/** Slot iklan vertikal kontekstual halaman artikel (dipassing dari ArticleUi). */
export interface SidebarVerticalArticleAd {
  adId: string;
  bannerUrl: string;
  name: string;
  linkUrl: string;
}

// ─── Sub-component: Article List Item ─────────────────────────────────────────

/**
 * Satu item artikel dalam daftar sidebar.
 * Menampilkan: kategori, judul, excerpt (terpotong), dan nama penulis.
 * Komponen ini digunakan ulang di semua section sidebar.
 */
function SidebarArticleItem({
  article,
  index,
}: {
  article: ArticleListResponse;
  index: number;
}) {
  return (
    <Link
      href={resolvePublicArticleHref(article)}
      className="group block py-3 border-b border-muted last:border-b-0"
      onClick={() => trackSelectContent({
        article_id: String(article._id ?? ""),
        article_slug: article.slug ?? "",
        article_title: article.title ?? "",
        category_name: article.category?.name ?? "",
        click_location: "sidebar",
        position: index + 1,
      })}
    >
      {/* Kategori */}
      {article.category?.name && (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
          {article.category.name}
        </span>
      )}

      {/* Judul */}
      <h4 className="text-sm font-semibold leading-snug mt-0.5 line-clamp-2 group-hover:text-primary transition-colors">
        {article.title}
      </h4>

      {/* Excerpt */}
      {article.excerpt && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
          {article.excerpt}
        </p>
      )}

      {/* Author */}
      <p className="text-[10px] text-muted-foreground/70 mt-1.5">
        {article.author?.name || "ARASVARA"}
      </p>
    </Link>
  );
}

// ─── Sub-component: Skeleton Item ─────────────────────────────────────────────

/** Skeleton placeholder untuk satu item artikel saat data belum tersedia */
function SidebarArticleItemSkeleton() {
  return (
    <div className="py-3 border-b border-muted last:border-b-0 flex flex-col gap-1.5">
      <Skeleton className="h-2.5 w-16" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3 w-full mt-0.5" />
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-2.5 w-20 mt-0.5" />
    </div>
  );
}

// ─── Sub-component: Section ───────────────────────────────────────────────────

interface SidebarSectionProps {
  /** Judul section, contoh: "Artikel Populer" */
  title: string;
  /**
   * Daftar section item dari API — dibatasi maks 6 item.
   * Item yang `article`-nya undefined akan dilewati.
   */
  items: SectionArticleItem[];
  isLoading?: boolean;
}

/**
 * Section sidebar yang reusable.
 * Terdiri dari: judul → divider → daftar artikel (maks 6).
 * Digunakan oleh semua section: populer, headline, unggulan, pilihan editor.
 */
function SidebarSection({ title, items, isLoading }: SidebarSectionProps) {
  // Saring item yang memiliki data artikel, kemudian batasi maks 4
  const validItems = (items ?? [])
    .filter(
      (item): item is SectionArticleItem & { article: ArticleListResponse } =>
        item.article !== undefined && item.article !== null,
    )
    .slice(0, 5);

  const skeletonCount = 5;

  return (
    <section>
      {/* Judul section */}
      <h3 className="text-base font-bold tracking-tight">{title}</h3>

      {/* Divider */}
      <div className="h-[2px] bg-primary mt-1.5  rounded-full" />

      {/* Daftar artikel atau skeleton */}
      <div>
        {isLoading
          ? Array.from({ length: skeletonCount }).map((_, i) => (
              <SidebarArticleItemSkeleton key={i} />
            ))
          : validItems.map((item, index) => (
              <SidebarArticleItem
                key={item._id ?? item.article.slug}
                article={item.article}
                index={index}
              />
            ))}

        {/* Empty state — tampil jika tidak loading dan tidak ada data */}
        {!isLoading && validItems.length === 0 && (
          <p className="text-xs text-muted-foreground py-3">
            Tidak ada artikel tersedia.
          </p>
        )}
      </div>
    </section>
  );
}

// ─── Reusable Sidebar Content ────────────────────────────────────────────────
/**
 * Komponen berisi konten sidebar (populer, headline, dll).
 * Di-ekstrak agar bisa digunakan di Sidebar desktop maupun Drawer mobile (DRY).
 */
function SidebarVerticalAd({
  ad,
}: {
  ad: SidebarVerticalArticleAd;
}) {
  const adRef = useRef<HTMLDivElement>(null);

  useAdImpressionTracking(adRef, {
    ad_id: ad.adId,
    ad_position: "article_vertical",
    ad_size: "300x600",
    ad_sponsor: ad.name,
  });

  const handleClick = useCallback(() => {
    trackAdClick(ad.adId, "article");
    trackGaAdClick({
      ad_id: ad.adId,
      ad_position: "article_vertical",
      ad_size: "300x600",
      ad_sponsor: ad.name,
      ad_destination_url: ad.linkUrl,
    });
  }, [ad.adId, ad.linkUrl, ad.name]);

  return (
    <div
      ref={adRef}
      className="mx-auto aspect-300/600 w-full max-w-sm md:mx-0 md:h-full md:w-auto md:max-w-none md:min-h-0"
    >
      <a
        href={ad.linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-full w-full min-h-0"
        onClick={handleClick}
      >
        <BaseAdCard
          width={300}
          height={600}
          defaultSrc={ADS_CARD_DEFAULT_BANNER}
          src={ad.bannerUrl}
          alt={ad.name}
          fill
          interactive
        />
      </a>
    </div>
  );
}

export function SidebarContent({
  verticalArticleAd,
}: {
  verticalArticleAd?: SidebarVerticalArticleAd | null;
} = {}) {
  const { data: featuredItems = [], isLoading: isLoadingFeatured } =
    useGridSection();

  const { data: headlineItems = [], isLoading: isLoadingHeadline } =
    useHeadlineArticles();

  return (
    <div className="flex flex-col gap-8">
      <SidebarSection
        title="Headline News"
        items={headlineItems}
        isLoading={isLoadingHeadline}
      />

      {verticalArticleAd?.linkUrl && verticalArticleAd.bannerUrl && (
        <SidebarVerticalAd ad={verticalArticleAd} />
      )}

      <SidebarSection
        title="Artikel Unggulan"
        items={featuredItems}
        isLoading={isLoadingFeatured}
      />
    </div>
  );
}

interface SidebarSingleArticleProps {
  /** Apakah sidebar sedang terbuka (untuk animasi slide) */
  isOpen?: boolean;
  className?: string;
  /** Iklan vertikal kontekstual (halaman artikel). */
  verticalArticleAd?: SidebarVerticalArticleAd | null;
}

/**
 * Sidebar untuk halaman detail artikel.
 * Data di-fetch secara mandiri via React Query (cache dibagi dengan homepage).
 * Menampilkan empat section: Artikel Populer, Headline, Berita Unggulan, Pilihan Editor.
 */
const SidebarSingleArticle = ({
  isOpen = true,
  className,
  verticalArticleAd = null,
}: SidebarSingleArticleProps) => {
  // offsetTop = 160px agar tidak tertutup navbar
  // offsetBottom = 24px jarak aman dari bawah viewport
  // Disable sticky tracking saat sidebar tertutup untuk efisiensi
  const sidebarRef = useBidirectionalSticky(160, 24, isOpen);

  return (
    <aside
      ref={sidebarRef}
      className={cn("self-start hidden md:block", className)}
      style={{
        width: isOpen ? "25%" : "0%",
        opacity: isOpen ? 1 : 0,
        overflow: "hidden",
        flexShrink: 0,
        transition: [
          "width 500ms cubic-bezier(0.4, 0, 0.2, 1)",
          "opacity 400ms cubic-bezier(0.4, 0, 0.2, 1)",
        ].join(", "),
      }}
      aria-hidden={!isOpen}
    >
      <SidebarContent verticalArticleAd={verticalArticleAd} />
    </aside>
  );
};

export default SidebarSingleArticle;
