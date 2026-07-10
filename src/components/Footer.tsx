"use client";

import Link from "next/link";
import { Copyright } from "lucide-react";
import Image from "next/image";
import { FOOTER_MORE } from "@/lib/constants";
import { useConfiguration } from "@/hooks/useConfiguration";
import {
  FacebookIcon,
  InstagramIcon,
  TelegramIcon,
  ThreadsIcon,
  WaIcon,
  XIcon,
} from "./icon/SocmedIcon";
// ── Kelas CSS yang dipakai berulang ──────────────────────────────────────────
const footerLinkClass =
  "text-muted-foreground hover:text-white transition-colors text-sm";

const columnTitleClass =
  "text-xl font-semibold uppercase tracking-wider mb-4 text-white";

// ── Teks hak cipta fallback jika belum dikonfigurasi ─────────────────────────
const DEFAULT_COPYRIGHT =
  "© 2025 Arasvara Media. All rights reserved. Arasvara may earn a commission from purchases made through links on this site as part of our affiliate partnerships with selected retailers. The material on this site may not be reproduced, distributed, transmitted, cached, or otherwise used, except with prior written permission from Arasvara Media.";

// ── Definisi ikon sosial media ────────────────────────────────────────────────
interface SocialLink {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export default function Footer() {
  const { getStringValue, isLoading } = useConfiguration();

  // Ambil data dari konfigurasi
  const copyrightText = getStringValue("copyright_text", DEFAULT_COPYRIGHT);
  const instagramLink = getStringValue("social_instagram_link");
  const twitterLink = getStringValue("social_twitter_link");
  const facebookLink = getStringValue("social_facebook_link");
  const threadsLink = getStringValue("social_threads_link");
  const whatsappChannel = getStringValue("whatsapp_channel");
  const telegramGroup = getStringValue("telegram_group");

  // Bangun daftar sosial media secara dinamis dari konfigurasi
  const socialLinks: SocialLink[] = [];

  if (instagramLink) {
    socialLinks.push({
      name: "Instagram",
      href: instagramLink,
      icon: InstagramIcon,
    });
  }
  if (twitterLink) {
    socialLinks.push({
      name: "X (Twitter)",
      href: twitterLink,
      icon: XIcon,
    });
  }
  if (facebookLink) {
    socialLinks.push({
      name: "Facebook",
      href: facebookLink,
      icon: FacebookIcon,
    });
  }
  if (threadsLink) {
    socialLinks.push({
      name: "Threads",
      href: threadsLink,
      icon: ThreadsIcon,
    });
  }
  if (whatsappChannel) {
    socialLinks.push({
      name: "WhatsApp Channel",
      href: whatsappChannel,
      icon: WaIcon,
    });
  }
  if (telegramGroup) {
    socialLinks.push({
      name: "Telegram",
      href: telegramGroup,
      icon: TelegramIcon,
    });
  }

  return (
    <footer className="bg-primary text-white py-10 md:py-12">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-x-10 xl:gap-x-16">
          {/* Logo */}
          <div className="flex shrink-0 justify-center lg:justify-start lg:pt-1">
            <Link
              href="/"
              className="relative block h-20 w-44 sm:h-24 sm:w-52 md:w-56"
              aria-label="Beranda Arasvara"
            >
              <Image
                src="/logo-arasvara/stacked-logo/stacked-logo-putih-naskah.png"
                alt="Arasvara"
                fill
                unoptimized
                className="hidden object-contain object-left lg:block"
                sizes="224px"
                priority
              />
              <Image
                src="/logo-arasvara/main-logo/main-logo-putih-naskah.png"
                alt="Arasvara"
                fill
                unoptimized
                className="object-contain object-center lg:hidden"
                sizes="(max-width: 1024px) 224px"
                priority
              />
            </Link>
          </div>

          {/* More */}
          <nav
            className="min-w-0 text-center lg:w-auto lg:shrink-0 lg:text-left"
            aria-label="Tautan lainnya"
          >
            <h4 className={columnTitleClass}>More</h4>
            <ul className="flex flex-col items-center gap-2 lg:items-start">
              {FOOTER_MORE.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={footerLinkClass}>
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Deskripsi, hak cipta, dan sosial media */}
          <div className="flex min-w-0 flex-1 flex-col gap-5 text-center lg:max-w-2xl lg:text-left">
            {/* Copyright text — tampilkan skeleton kecil saat loading */}
            {isLoading ? (
              <div className="h-12 w-full animate-pulse rounded bg-white/10" />
            ) : (
              <p className="text-xs leading-relaxed text-gray-400">
                <Copyright className="inline-block w-3.5 h-3.5" /> 2026.{" "}
                {copyrightText}
              </p>
            )}

            {/* Ikon sosial media dari konfigurasi */}
            <div
              className="flex flex-wrap items-center justify-center gap-5 lg:justify-start"
              aria-label="Media sosial Arasvara"
            >
              {isLoading ? (
                // Skeleton sosial media
                <>
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={`social-skeleton-${i}`}
                      className="h-7 w-7 animate-pulse rounded-full bg-white/10 sm:h-8 sm:w-8"
                    />
                  ))}
                </>
              ) : (
                socialLinks.map((social) => {
                  const Icon = social.icon;
                  return (
                    <a
                      key={social.name}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 transition-colors hover:text-white"
                      aria-label={social.name}
                    >
                      <Icon className="h-7 w-7 sm:h-8 sm:w-8" />
                    </a>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
