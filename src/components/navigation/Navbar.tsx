"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation"; // 1. Import usePathname
import { useTheme } from "next-themes";
import { Search, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import NotificationButton from "../notification/NotificationButton";
import { usePushNotification } from "@/hooks/usePushNotification";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCategoriesNavbar } from "@/hooks/useCategory";
import { Category } from "@/types/category";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

function navbarCategoryLabel(cat: Category): string {
  const n = cat.nickname?.trim();
  return n ? n : cat.name;
}

interface NavbarProps {
  onMenuOpen: () => void;
  active: string | null;
}

const Navbar = ({ onMenuOpen, active }: NavbarProps) => {
  const [mounted, setMounted] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const pathname = usePathname(); // 2. Ambil path saat ini

  const { data: userAuthed } = useCurrentUser();
  const { subscribe, unsubscribe, isSubscribed } = usePushNotification();
  const { data: categories } = useCategoriesNavbar();

  // Tentukan halaman spesial (Homepage & About Us)
  const isSpecialPage = pathname === "/about-us";

  const mid = Math.ceil((categories?.length || 0) / 2);
  const leftCategories: Category[] = (categories || []).slice(0, mid + 1);
  const rightCategories: Category[] = (categories || []).slice(mid + 1);

  useEffect(() => {
    setMounted(true);
    gsap.registerPlugin(ScrollTrigger);

    let hideTimer: NodeJS.Timeout;

    const ctx = gsap.context(() => {
      if (!headerRef.current) return;

      const showAnim = gsap.from(headerRef.current, {
        yPercent: -100,
        paused: true,
        duration: 0.3,
        ease: "power2.out",
      });

      // Inisialisasi awal
      if (!isSpecialPage) {
        showAnim.progress(1);
      } else {
        showAnim.progress(0);
      }

      ScrollTrigger.create({
        start: "top top",
        end: "max",
        onUpdate: (self) => {
          const scrollY = window.scrollY;
          clearTimeout(hideTimer);

          if (self.direction === -1) {
            // --- LOGIKA SCROLL KE ATAS ---

            if (isSpecialPage) {
              // Halaman Spesial (Home/About Us)
              if (scrollY > 100) {
                showAnim.play();
              } else if (scrollY <= 10) {
                // Sembunyi dengan delay 3 detik hanya di halaman spesial
                hideTimer = setTimeout(() => {
                  showAnim.reverse();
                }, 3000);
              }
            } else {
              // Halaman Lain (Selalu tampil saat scroll up / mentok atas)
              showAnim.play();
            }
          } else if (self.direction === 1) {
            // --- LOGIKA SCROLL KE BAWAH ---

            // Semua halaman akan menyembunyikan navbar saat scroll ke bawah
            if (scrollY > 50) {
              showAnim.reverse();
            }
          }
        },
      });
    }, headerRef);

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(hideTimer);
      ctx.revert();
    };
  }, [pathname, isSpecialPage]);

  return (
    <header
      ref={headerRef}
      className={`fixed top-0 left-0 right-0 z-999 bg-background/80 backdrop-blur-sm transition-colors duration-300 ${
        isScrolled ? "shadow-sm border-b border-foreground/10" : ""
      }`}
    >
      <div className="container mx-auto px-4 pb-2">
        {/* Konten Navbar tetap sama seperti sebelumnya */}
        <div className="flex flex-row justify-end items-center pt-6">
          <div className="flex items-center space-x-2">
            {userAuthed && (
              <>
                <div className="flex items-center gap-1">
                  <Switch
                    checked={isSubscribed}
                    onCheckedChange={(checked) =>
                      checked
                        ? subscribe({ persistToBackend: true })
                        : unsubscribe({ removeFromBackend: true })
                    }
                    id="push-notif-switch"
                  />
                </div>
                <NotificationButton />
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between h-14">
          <div className="hidden lg:flex items-center gap-x-1 w-2/5">
            {leftCategories.map((category) => (
              <Link
                key={String(category._id ?? category.slug)}
                href={`/${category.slug}`}
                title={category.name}
                className={`px-2 py-1 text-[11px] font-medium uppercase tracking-wider ${
                  active === category.name.toLowerCase()
                    ? "text-hijauSawah"
                    : "text-foreground/80"
                } hover:text-foreground transition-colors`}
              >
                {navbarCategoryLabel(category)}
              </Link>
            ))}
          </div>

          <Link href="/" className="flex items-center">
            <Image
              src="/logo-arasvara/main-logo/main-logo-hitam-gema.png"
              alt="Arasvara Logo"
              width={200}
              height={80}
              unoptimized
            />
          </Link>

          <div className="hidden lg:flex items-center gap-x-1 w-2/5 justify-end">
            {rightCategories.map((category) => (
              <Link
                key={String(category._id ?? category.slug)}
                href={`/${category.slug}`}
                title={category.name}
                className={`px-2 py-1 text-[11px] font-medium uppercase tracking-wider ${
                  active === category.name.toLowerCase()
                    ? "text-hijauSawah"
                    : "text-foreground/80"
                } hover:text-foreground transition-colors`}
              >
                {navbarCategoryLabel(category)}
              </Link>
            ))}
            <Link
              href="/about-us"
              className={`px-2 py-1 text-[11px] font-medium uppercase tracking-wider ${
                pathname === "/about-us"
                  ? "text-hijauSawah"
                  : "text-foreground/80"
              } hover:text-foreground transition-colors`}
            >
              About Us
            </Link>
            <Link
              href="/search"
              className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider hover:text-foreground transition-colors flex items-center gap-2"
            >
              <Search className="h-4 w-4" />
              Search
            </Link>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuOpen}
            className="lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        <div className="double-line-in-header"></div>
        <div className="spacer-2"></div>
        <div className="double-line-in-header"></div>
      </div>
    </header>
  );
};

export default Navbar;
