"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NavbarInside = () => {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Helper untuk mendeteksi apakah tautan aktif
  const isActive = (href: string) => pathname === href;

  // Daftar tautan menu inside
  const links = [
    { href: "/about-us", label: "About Us" },
    { href: "/pedoman-media-siber", label: "Pedoman Media Siber" },
    { href: "/disclaimer", label: "Disclaimer" },
  ];

  return (
    <>
      {/* Navbar Utama (Desktop & Mobile Header) */}
      <nav className="w-full fixed top-0 z-50 bg-background/80 backdrop-blur-md border-b border-foreground/10 h-20 flex items-center">
        <div className="container xl:max-w-6xl mx-auto px-4 md:px-0 flex items-center justify-between w-full">
          {/* Logo */}
          <Link href="/" className="z-50 flex items-center">
            <Image
              src="/logo-arasvara/main-logo/main-logo-hitam-gema.png"
              alt="Arasvara Logo"
              width={200}
              height={80}
              className="w-auto h-6 lg:h-8 object-contain"
            />
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-6">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm font-medium capitalize tracking-wider transition-colors hover:text-hijauSawah",
                  isActive(link.href)
                    ? "text-hijauSawah"
                    : "text-foreground/80",
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Hamburger Button (Hanya tampil di Mobile) */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-foreground/5 transition-colors focus:outline-none z-50 text-foreground"
            aria-label="Navigasi Menu"
            aria-expanded={isOpen}
          >
            {isOpen ? (
              <X className="h-6 w-6 text-foreground transition-all duration-300" />
            ) : (
              <Menu className="h-6 w-6 text-foreground transition-all duration-300" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer (Menu yang meluncur turun dari atas) */}
      <div
        className={cn(
          "fixed inset-x-0 top-0 bg-background border-b border-foreground/10 z-40 transition-all duration-300 ease-in-out md:hidden flex flex-col shadow-2xl",
          isOpen
            ? "translate-y-0 opacity-100"
            : "-translate-y-full opacity-0 pointer-events-none",
        )}
      >
        {/* Header di dalam Drawer untuk visualisasi logo */}
        <div className="h-20 flex items-center px-4 border-b border-foreground/5">
          <Image
            src="/logo-arasvara/main-logo/main-logo-hitam-gema.png"
            alt="Arasvara Logo"
            width={150}
            height={60}
            className="w-auto h-5 object-contain"
          />
        </div>

        {/* Daftar Tautan Menu Drawer */}
        <div className="flex flex-col px-4 py-4 space-y-0 bg-background">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className={cn(
                "text-base font-semibold capitalize tracking-wider py-2 px-4 rounded-xl transition-all duration-300",
                isActive(link.href)
                  ? "bg-hijauSawah/10 text-hijauSawah font-bold"
                  : "text-foreground/80 hover:bg-foreground/5 hover:text-hijauSawah",
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Backdrop Gelap saat Drawer Terbuka (Membantu fokus pengguna) */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-30 md:hidden transition-all duration-300"
          aria-hidden="true"
        />
      )}
    </>
  );
};

export default NavbarInside;
