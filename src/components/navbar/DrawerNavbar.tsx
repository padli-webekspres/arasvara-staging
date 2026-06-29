"use client";

import React, { useMemo } from "react";
import {
  DrawerContent,
  DrawerClose,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Search,
  X,
} from "lucide-react";
import PageNavbar from "./PageNavbar";
import { FOOTER_MORE, FOOTER_SECTION_LINKS } from "@/lib/constants";
import { useRootCategories } from "@/hooks/useCategory";
import type { Category } from "@/types/category";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfiguration } from "@/hooks/useConfiguration";
import {
  FacebookIcon,
  InstagramIcon,
  TelegramIcon,
  ThreadsIcon,
  WaIcon,
  XIcon,
} from "../icon/SocmedIcon";

function categoryDrawerHref(cat: Category): string {
  const slug = String(cat.slug ?? "").trim();
  if (slug) return `/category/${encodeURIComponent(slug)}`;
  const id = cat._id != null ? String(cat._id) : "";
  return id ? `/category/${encodeURIComponent(id)}` : "#";
}

const linkClass =
  "text-muted-foreground hover:text-hijauSawah transition-colors text-sm";

const columnTitleClass =
  "text-base font-semibold uppercase tracking-wider mb-4 text-foreground";

interface DrawerNavbarProps {
  pathname: string;
  searchValue: string;
  onChangeInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDownInput: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const DrawerNavbar = ({
  pathname,
  searchValue,
  onChangeInput,
  onKeyDownInput,
}: DrawerNavbarProps) => {
  const { data: categories = [], isPending } = useRootCategories();
  const { getStringValue, isLoading } = useConfiguration();

  const instagramLink = getStringValue("social_instagram_link");
  const twitterLink = getStringValue("social_twitter_link");
  const facebookLink = getStringValue("social_facebook_link");
  const threadsLink = getStringValue("social_threads_link");
  const whatsappChannel = getStringValue("whatsapp_channel");
  const telegramGroup = getStringValue("telegram_group");

  const socialLinks: Array<{
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [];
  if (instagramLink) {
    socialLinks.push({
      name: "Instagram",
      href: instagramLink,
      icon: InstagramIcon,
    });
  }
  if (twitterLink) {
    socialLinks.push({ name: "X (Twitter)", href: twitterLink, icon: XIcon });
  }
  if (facebookLink) {
    socialLinks.push({ name: "Facebook", href: facebookLink, icon: FacebookIcon });
  }
  if (threadsLink) {
    socialLinks.push({ name: "Threads", href: threadsLink, icon: ThreadsIcon });
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

  const channelsSorted = useMemo(() => {
    return [...categories].sort((a, b) =>
      a.name.localeCompare(b.name, "id", { sensitivity: "base" }),
    );
  }, [categories]);

  return (
    <DrawerContent className="z-1000 top-0 right-0 left-0 mt-0 rounded-none border-none bg-background px-4 py-6 text-foreground md:px-8 overflow-y-auto">
      <DrawerTitle className="sr-only">Menu navigasi</DrawerTitle>
      <DrawerDescription className="sr-only">
        Jelajahi berdasarkan bagian, kanal, dan tautan lainnya.
      </DrawerDescription>

      <div className="container mx-auto mb-8 space-y-5">
        {/* Row 1: dashboard */}
        <div className="min-w-0 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex justify-between items-start gap-8">
            <div className="space-y-2 w-full">
              <PageNavbar pathname={pathname} />
              {/* Row 2: search + close aligned right */}
              <div className="flex w-full items-center border-b border-foreground/30 pb-1 md:w-64">
                <input
                  type="text"
                  placeholder="Cari…"
                  className="w-full bg-transparent text-sm font-medium outline-none"
                  value={searchValue}
                  onChange={onChangeInput}
                  onKeyDown={onKeyDownInput}
                  aria-label="Cari"
                />
                <Search className="h-5 w-5 shrink-0 text-foreground/50" />
              </div>
            </div>
            <DrawerClose className="" asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full hover:bg-background/50"
                aria-label="Tutup menu"
              >
                <X className="h-8 w-8 text-hijauSawah" />
              </Button>
            </DrawerClose>
          </div>
        </div>
      </div>

      <div className="container mx-auto flex flex-col">
        <div className="mb-12 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-6">
          <div className="col-span-1 sm:col-span-2 sm:order-1 lg:col-span-1">
            <h2 className="text-2xl font-bold md:text-3xl">Explore by</h2>
          </div>
          {/* Sections — sama pola Footer */}
          <div className="col-span-1 lg:col-span-2 sm:order-3">
            <h3 className={columnTitleClass}>Sections</h3>
            <div className="grid grid-cols-2 gap-2">
              {FOOTER_SECTION_LINKS.map((section) => (
                <div className="text-start" key={section.href}>
                  <DrawerClose asChild>
                    <Link href={section.href} className={linkClass}>
                      {section.name}
                    </Link>
                  </DrawerClose>
                </div>
              ))}
              <div className="text-start">
                <DrawerClose asChild>
                  <Link href="/indeks" className={linkClass}>
                    Indeks Berita
                  </Link>
                </DrawerClose>
              </div>
            </div>
          </div>

          {/* Channel — semua kategori A–Z */}
          <div className="col-span-1 lg:col-span-2 sm:order-2 sm:col-span-2">
            <h3 className={columnTitleClass}>Channel</h3>
            {isPending ? (
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full rounded-none" />
                ))}
              </div>
            ) : channelsSorted.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Kanal tidak tersedia.
              </p>
            ) : (
              <div className="grid max-h-[40vh] grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2 overflow-y-auto pr-1 sm:max-h-none">
                {channelsSorted.map((cat) => (
                  <div
                    className="min-w-0 text-start"
                    key={String(cat._id ?? cat.slug)}
                  >
                    <DrawerClose asChild>
                      <Link
                        href={categoryDrawerHref(cat)}
                        className={`${linkClass} block truncate`}
                        title={cat.name}
                      >
                        {cat.name}
                      </Link>
                    </DrawerClose>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* More */}
          <div className="sm:col-span-1 lg:col-span-1 sm:order-4">
            <h3 className={columnTitleClass}>More</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {FOOTER_MORE.map((item) => (
                <div className="text-start" key={item.href}>
                  <DrawerClose asChild>
                    <Link href={item.href} className={linkClass}>
                      {item.name}
                    </Link>
                  </DrawerClose>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-foreground/20 py-6">
          <span className="mb-4 block text-xs font-bold uppercase tracking-widest text-hijauSawah">
            Ikuti kami
          </span>
          <div
            className="flex flex-wrap items-center gap-5"
            aria-label="Media sosial Arasvara"
          >
            {isLoading ? (
              <>
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-7 w-7 animate-pulse rounded-full bg-foreground/10 sm:h-8 sm:w-8"
                  />
                ))}
              </>
            ) : (
              socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <DrawerClose key={social.href} asChild>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground transition-colors hover:text-hijauSawah"
                      aria-label={social.name}
                    >
                      <Icon className="h-7 w-7 sm:h-8 sm:w-8" />
                    </a>
                  </DrawerClose>
                );
              })
            )}
          </div>
        </div>
      </div>
    </DrawerContent>
  );
};

export default DrawerNavbar;
