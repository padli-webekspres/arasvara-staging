"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePushNotification } from "@/hooks/usePushNotification";
import { useCategoriesNavbar } from "@/hooks/useCategory";
import { Category } from "@/types/category";
import { Button } from "../ui/button";
import { Menu, Search } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import DoubleLineBorder from "../ui/DoubleLineBorder";
import { Drawer, DrawerTrigger } from "@/components/ui/drawer";
import DrawerNavbar from "./DrawerNavbar";
import { Skeleton } from "@/components/ui/skeleton";
import { MAX_NAVBAR_CATEGORIES } from "@/components/categories/navbarOrderPayload";
import { adminPanelHref } from "@/lib/admin-panel-path";
import { ROLES } from "@/lib/auth-client";

/** Bagi kategori navbar: kiri dapat slot ekstra jika jumlah ganjil. */
function splitNavbarCategories(categories: Category[]): {
  left: Category[];
  right: Category[];
} {
  const leftCount = Math.ceil(categories.length / 2);
  return {
    left: categories.slice(0, leftCount),
    right: categories.slice(leftCount),
  };
}

const mastheadLinkClassName =
  "text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground hover:text-hijauSawah transition-colors underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hijauSawah/40 rounded-sm";

/** Label pendek masthead: nickname jika diisi; jika tidak, nama kanal lengkap */
function navbarCategoryLabel(cat: Category): string {
  const n = cat.nickname?.trim();
  return n ? n : cat.name;
}

function CategoryBulletLinks({
  categories,
  ariaLabel,
}: {
  categories: Category[];
  ariaLabel?: string;
}) {
  if (categories.length === 0) return null;

  return (
    <nav
      className={`flex flex-wrap items-center gap-x-2 gap-y-1.5 justify-evenly`}
      aria-label={ariaLabel ?? "Kanal berita"}
    >
      {categories.map((cat, i) => (
        <React.Fragment key={String(cat._id ?? cat.slug)}>
          {i > 0 && (
            <span className="text-foreground/40 select-none" aria-hidden>
              •
            </span>
          )}
          <Link
            href={`/category/${cat.slug}`}
            title={cat.name}
            className={mastheadLinkClassName}
          >
            {navbarCategoryLabel(cat)}
          </Link>
        </React.Fragment>
      ))}
    </nav>
  );
}

/** Placeholder kategori masthead sementara fetch `/api/categories` (navbar). */
function MastheadCategoriesSkeleton({
  count = 3,
  ariaLabel = "Memuat kanal berita",
}: {
  count?: number;
  ariaLabel?: string;
}) {
  return (
    <nav
      className="flex flex-wrap items-center gap-x-2 gap-y-1.5 justify-evenly"
      aria-busy="true"
      aria-label={ariaLabel}
    >
      {Array.from({ length: count }, (_, i) => `masthead-sk-${i}`).map(
        (skKey, i) => (
          <React.Fragment key={skKey}>
            {i > 0 && (
              <span className="text-foreground/40 select-none" aria-hidden>
                •
              </span>
            )}
            <Skeleton className="h-3.5 w-17 sm:w-20 rounded-sm" />
          </React.Fragment>
        ),
      )}
    </nav>
  );
}

const mobileMastheadLinkClassName =
  "snap-center shrink-0 text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest text-foreground hover:text-hijauSawah transition-colors py-2 px-1 min-h-[44px] flex items-center";

const dashboardLinkClassName =
  "text-sm font-medium capitalize tracking-wider hover:text-hijauSawah transition-colors";

const NavbarContainer = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const isSpecialPage = pathname === "/about-us";
  const [isVisible, setIsVisible] = useState(!isSpecialPage);
  const lastScrollY = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const executeSearch = () => {
    if (searchValue.trim().length >= 2) {
      router.push(
        `/search?type=ARTICLES&q=${encodeURIComponent(searchValue.trim())}`,
      );
      setIsSearchOpen(false);
      setIsDrawerOpen(false);
    } else {
      setIsSearchOpen(false);
      setSearchValue("");
    }
  };

  const handleSearchClick = () => {
    if (!isSearchOpen) {
      setIsSearchOpen(true);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } else {
      executeSearch();
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      executeSearch();
    } else if (e.key === "Escape") {
      setIsSearchOpen(false);
    }
  };

  const { data: user } = useCurrentUser();
  usePushNotification();
  const { data: categories, isPending: isCategoriesPending } =
    useCategoriesNavbar();

  const canShowDashboard = useMemo(() => {
    const role = String(user?.role ?? "").toLowerCase();
    if (!role) return false;
    const allowedRoles = [
      ROLES.ADMIN,
      ROLES.EDITOR_IN_CHIEF,
      ROLES.MANAGING_EDITOR,
      ROLES.HEAD_OF,
      ROLES.EDITOR,
      ROLES.REPORTER,
      ROLES.WRITER,
      ROLES.CONTRIBUTOR,
      ROLES.ACCOUNT_EXECUTIVE,
    ].map((r) => String(r).toLowerCase());
    return allowedRoles.includes(role);
  }, [user?.role]);

  /** Kanal dari API (showOnNavbar), maks. 6, dibagi rata kiri/kanan (ganjil → kiri lebih banyak). */
  const categoryList = useMemo(
    () => (categories ?? []).slice(0, MAX_NAVBAR_CATEGORIES),
    [categories],
  );

  const mastheadLayout = useMemo(
    () => splitNavbarCategories(categoryList),
    [categoryList],
  );

  const mastheadSkeletonCount = useMemo(() => {
    const n = categoryList.length;
    if (n === 0) return 3;
    return Math.ceil(n / 2);
  }, [categoryList.length]);

  // Mengatur visibilitas default saat rute/halaman berubah
  useEffect(() => {
    setIsVisible(!isSpecialPage);
    lastScrollY.current = Math.max(0, window.scrollY);
  }, [pathname, isSpecialPage]);

  // Event listener untuk melacak scroll dan menyembunyikan/menampilkan navbar secara efisien
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = Math.max(0, window.scrollY);

      // Set state isScrolled untuk mengubah style bayangan & border navbar
      setIsScrolled(currentScrollY > 10);

      // Bersihkan timer penutupan tertunda jika ada
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      // Tentukan arah gerakan scroll
      const isScrollingDown = currentScrollY > lastScrollY.current;

      if (isSpecialPage) {
        // Perilaku khusus halaman '/about-us':
        if (isScrollingDown) {
          if (currentScrollY > 50) {
            setIsVisible(false);
          }
        } else {
          if (currentScrollY > 100) {
            setIsVisible(true);
          } else if (currentScrollY <= 10) {
            // Sembunyikan otomatis setelah 3 detik saat kembali ke paling atas
            hideTimerRef.current = setTimeout(() => {
              setIsVisible(false);
            }, 3000);
          }
        }
      } else {
        // Perilaku halaman normal:
        if (isScrollingDown) {
          // Hanya sembunyikan jika scroll melebihi 150px untuk menghindari sensitivitas tinggi di bagian atas
          if (currentScrollY > 150) {
            setIsVisible(false);
          }
        } else {
          setIsVisible(true);
        }
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [isSpecialPage]);

  return (
    <>
      <Drawer
        direction="top"
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
      >
        <header
          ref={headerRef}
          className={`fixed top-0 left-0 right-0 z-99 pb-4 pt-3 sm:pb-5 sm:pt-4 bg-background/85 backdrop-blur-md transition-all duration-300 ease-in-out ${
            isScrolled ? "shadow-sm border-b border-foreground/10" : ""
          } ${isVisible ? "translate-y-0" : "-translate-y-full"}`}
        >
          {/* Desktop top bar: navigasi halaman + cari + menu */}
          <div className="container mx-auto px-4 md:px-6 lg:px-8">
            <div
              className={`hidden lg:flex items-center gap-2 sm:gap-4 ${canShowDashboard ? "justify-between" : "justify-end"}`}
            >
              {canShowDashboard && (
                <div className="min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="inline-flex min-w-0">
                    <Link
                      href={adminPanelHref("")}
                      className={`${dashboardLinkClassName} ${
                        pathname === adminPanelHref()
                          ? "text-hijauSawah"
                          : "text-foreground/80"
                      }`}
                    >
                      Dashboard
                    </Link>
                  </div>
                </div>
              )}

              <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                <div
                  className={`overflow-hidden transition-all duration-300 ease-out ${
                    isSearchOpen
                      ? "w-[min(100vw-8rem,14rem)] sm:w-52 lg:w-64 opacity-100 mr-1 sm:mr-2"
                      : "w-0 opacity-0 mr-0"
                  }`}
                >
                  <label htmlFor="navbar-search" className="sr-only">
                    Cari berita
                  </label>
                  <input
                    id="navbar-search"
                    ref={searchInputRef}
                    type="search"
                    placeholder="Cari berita..."
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="w-full bg-transparent border-b border-foreground/40 focus:outline-none focus:border-hijauSawah px-2 py-2 text-sm transition-colors min-h-[44px] sm:min-h-0 sm:py-1"
                    enterKeyHint="search"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  className="h-11 w-11 sm:h-10 sm:w-10 hover:bg-foreground/5 touch-manipulation"
                  onClick={handleSearchClick}
                  aria-label={
                    isSearchOpen ? "Jalankan pencarian" : "Buka kolom pencarian"
                  }
                  aria-expanded={isSearchOpen}
                >
                  <Search className="h-5 w-5" aria-hidden />
                </Button>
                <DrawerTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    className="h-11 w-11 sm:h-10 sm:w-10 hover:bg-foreground/5 touch-manipulation"
                    aria-label="Buka menu"
                  >
                    <Menu className="h-5 w-5" aria-hidden />
                  </Button>
                </DrawerTrigger>
              </div>
            </div>

            {/* Mobile top bar: Dashboard */}
            {canShowDashboard && (
              <div className="lg:hidden">
                <div className="min-w-0 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="inline-flex min-w-0">
                    <Link
                      href={adminPanelHref("")}
                      className={`${dashboardLinkClassName} ${
                        pathname === adminPanelHref()
                          ? "text-hijauSawah"
                          : "text-foreground/80"
                      }`}
                    >
                      Dashboard
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Masthead: mobile vs desktop */}
          <div className="container mx-auto px-4 md:px-6 lg:px-8 mt-3 sm:mt-4">
            <div className="block lg:hidden mb-4 lg:mb-0">
              <DoubleLineBorder />
            </div>
            {/* ─── Mobile & tablet: logo (left) + menu button (right), lalu scroll kanal ─── */}
            <div className="lg:hidden flex flex-col items-center gap-3">
              <div className="w-full flex items-center justify-between">
                <Link
                  href="/"
                  className="shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-hijauSawah/40 rounded-md"
                >
                  <Image
                    src="/logo-arasvara/main-logo/main-logo-hitam-gema.png"
                    alt="Arasvara"
                    width={220}
                    height={88}
                    priority
                    unoptimized
                    className="w-auto h-9 sm:h-10 object-contain"
                  />
                </Link>
                <DrawerTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    className="h-11 w-11 hover:bg-foreground/5 touch-manipulation"
                    aria-label="Buka menu"
                  >
                    <Menu className="h-5 w-5" aria-hidden />
                  </Button>
                </DrawerTrigger>
              </div>

              {/* <div className="w-full max-w-full space-y-2">
                <DoubleLineBorder />
                <div
                  className="-mx-1 px-1 overflow-x-auto overscroll-x-contain touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-1"
                  role="region"
                  aria-label="Kanal dan rubrik"
                >
                  {isCategoriesPending ? (
                    <MobileMastheadRowSkeleton />
                  ) : (
                    <div className="flex w-max min-w-full justify-center gap-x-2 gap-y-2 py-1 snap-x snap-mandatory items-center">
                      {mobileMastheadItems.map((item, idx) => (
                        <React.Fragment
                          key={
                            item.type === "category"
                              ? String(item.cat._id ?? item.cat.slug)
                              : `${item.href}-${item.label}`
                          }
                        >
                          {idx > 0 && (
                            <span
                              className="text-foreground/40 shrink-0 select-none"
                              aria-hidden
                            >
                              •
                            </span>
                          )}
                          {item.type === "category" ? (
                            <Link
                              href={`/category/${item.cat.slug}`}
                              title={item.cat.name}
                              className={mobileMastheadLinkClassName}
                            >
                              {navbarCategoryLabel(item.cat)}
                            </Link>
                          ) : (
                            <Link
                              href={item.href}
                              title={item.title ?? item.label}
                              className={`${mobileMastheadLinkClassName} whitespace-nowrap`}
                            >
                              {item.label}
                            </Link>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
                <DoubleLineBorder />
              </div> */}
            </div>

            {/* ─── Desktop: tiga kolom — kanal kiri | logo | kanal kanan ─── */}
            <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:gap-x-8 xl:gap-x-14">
              <div className="min-w-0 space-y-3 flex flex-col">
                <DoubleLineBorder />
                {isCategoriesPending ? (
                  <MastheadCategoriesSkeleton
                    count={mastheadSkeletonCount}
                    ariaLabel="Memuat kanal kiri"
                  />
                ) : (
                  <CategoryBulletLinks
                    categories={mastheadLayout.left}
                    ariaLabel="Kanal berita kiri"
                  />
                )}
                <DoubleLineBorder />
              </div>

              <Link
                href="/"
                className="justify-self-center shrink-0 px-4 xl:px-6 outline-none focus-visible:ring-2 focus-visible:ring-hijauSawah/40 rounded-md"
              >
                <Image
                  src="/logo-arasvara/main-logo/main-logo-hitam-gema.png"
                  alt="Arasvara"
                  width={240}
                  height={96}
                  priority
                  unoptimized
                  className="w-auto h-12  object-contain"
                />
              </Link>

              <div className="min-w-0 space-y-3 flex flex-col">
                <DoubleLineBorder />
                {isCategoriesPending ? (
                  <MastheadCategoriesSkeleton
                    count={
                      categoryList.length > 0
                        ? Math.floor(categoryList.length / 2)
                        : 3
                    }
                    ariaLabel="Memuat kanal kanan"
                  />
                ) : (
                  <CategoryBulletLinks
                    categories={mastheadLayout.right}
                    ariaLabel="Kanal berita kanan"
                  />
                )}
                <DoubleLineBorder />
              </div>
            </div>
            <div className="block lg:hidden mt-4 lg:mt-0">
              <DoubleLineBorder />
            </div>
          </div>
        </header>

        <DrawerNavbar
          pathname={pathname}
          searchValue={searchValue}
          onChangeInput={(e) => setSearchValue(e.target.value)}
          onKeyDownInput={handleSearchKeyDown}
        />
      </Drawer>
    </>
  );
};

export default NavbarContainer;
