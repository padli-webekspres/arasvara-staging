"use client";

import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { TikTokIcon } from "@/components/icon/SocmedIcon";
import { SocialEmbedLinkCard } from "@/components/news/SocialEmbedLinkCard";
import api from "@/lib/axios";
import {
  normalizeTikTokUrl,
  parseTikTokVideoId,
  tiktokEmbedSrc,
} from "@/lib/social-embed-url";

type Preview = {
  title: string | null;
  authorName: string | null;
  thumbnailUrl: string | null;
};

/**
 * Jangan auto-load iframe TikTok.
 * Player TikTok membaca Referer halaman induk; di HTTP/IP LAN itu memicu
 * "overload-protect triggered". Iframe baru dipasang saat user klik Play,
 * dengan referrerPolicy=no-referrer.
 */
export default function TikTokSocialEmbed({ url }: { url: string }) {
  const normalized = normalizeTikTokUrl(url);
  const videoId = parseTikTokVideoId(normalized);
  const [playing, setPlaying] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    api
      .get<Preview>("/embed/tiktok", { params: { url: normalized } })
      .then((res) => {
        if (!cancelled) setPreview(res.data);
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [normalized, videoId]);

  if (!videoId) {
    return (
      <SocialEmbedLinkCard
        href={normalized || url}
        icon={<TikTokIcon className="h-6 w-6 text-foreground" />}
        title="Video TikTok"
        description="Tautan ini tidak bisa di-embed (tautan pendek atau format tidak dikenali). Buka di TikTok."
      />
    );
  }

  return (
    <div className="flex w-full max-w-[325px] flex-col gap-2">
      {playing ? (
        <iframe
          src={tiktokEmbedSrc(videoId)}
          title={preview?.title || "TikTok video"}
          width="325"
          height="575"
          className="w-full max-w-[325px] rounded-lg border-0 bg-black"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write"
          allowFullScreen
          referrerPolicy="no-referrer"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="relative h-[575px] w-full max-w-[325px] overflow-hidden rounded-lg bg-black text-left"
          aria-label="Putar video TikTok"
        >
          {preview?.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="absolute inset-0 bg-zinc-900" />
          )}
          <span className="absolute inset-0 bg-black/25" />
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-black shadow-lg">
              <Play className="h-6 w-6 translate-x-0.5 fill-current" />
            </span>
            {preview?.authorName ? (
              <span className="line-clamp-2 text-center text-sm font-medium text-white drop-shadow">
                {preview.authorName}
                {preview.title ? ` — ${preview.title}` : ""}
              </span>
            ) : (
              <span className="text-sm text-white/90">Putar di halaman ini</span>
            )}
          </span>
        </button>
      )}
      <a
        href={normalized}
        target="_blank"
        rel="noopener noreferrer"
        className="text-center text-xs text-hijauSawah hover:underline"
      >
        Buka di TikTok
      </a>
    </div>
  );
}
