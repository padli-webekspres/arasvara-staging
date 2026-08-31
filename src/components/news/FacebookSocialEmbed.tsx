"use client";

import { useEffect, useState } from "react";
import { FacebookEmbed } from "react-social-media-embed";
import { FacebookIcon } from "@/components/icon/SocmedIcon";
import { SocialEmbedLinkCard } from "@/components/news/SocialEmbedLinkCard";
import api from "@/lib/axios";
import {
  classifyFacebookUrl,
  facebookPluginSrc,
  isFacebookShareShortLink,
  normalizeFacebookUrl,
} from "@/lib/social-embed-url";

const EMBED_WIDTH = 500;

function FacebookReelCard({ url }: { url: string }) {
  return (
    <SocialEmbedLinkCard
      href={url}
      icon={<FacebookIcon className="h-6 w-6 text-[#1877F2]" />}
      title="Reel Facebook"
      description="Facebook tidak mengizinkan reel ini diputar di situs lain (sering dari akun pribadi atau pengaturan privasi). Buka tautan untuk menonton di Facebook."
    />
  );
}

function FacebookEmbedView({ url }: { url: string }) {
  const kind = classifyFacebookUrl(url);

  if (kind === "marketplace") {
    return (
      <SocialEmbedLinkCard
        href={url}
        icon={<FacebookIcon className="h-6 w-6 text-[#1877F2]" />}
        title="Listing Facebook Marketplace"
        description="Facebook tidak mengizinkan listing Marketplace di-embed sebagai postingan. Buka tautan untuk melihat itemnya."
      />
    );
  }

  if (kind === "reel") {
    return <FacebookReelCard url={url} />;
  }

  if (kind === "unsupported") {
    return (
      <SocialEmbedLinkCard
        href={url}
        icon={<FacebookIcon className="h-6 w-6 text-[#1877F2]" />}
        title="Tautan Facebook"
        description="Tautan ini bukan postingan atau video yang bisa di-embed. Buka di Facebook."
      />
    );
  }

  if (kind === "video") {
    return (
      <iframe
        src={facebookPluginSrc(url, "video", EMBED_WIDTH)}
        width="100%"
        height="420"
        className="max-w-[500px] rounded-lg border-0"
        style={{ overflow: "hidden" }}
        scrolling="no"
        allowFullScreen
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        title="Facebook video"
      />
    );
  }

  return <FacebookEmbed url={url} width={EMBED_WIDTH} />;
}

export default function FacebookSocialEmbed({ url }: { url: string }) {
  const normalized = normalizeFacebookUrl(url);
  const initialKind = classifyFacebookUrl(normalized);
  // Reel tidak perlu di-resolve: plugin tetap menolak. Short link post (/share/p/)
  // masih dipecah ke /posts/ supaya FacebookEmbed mendapat URL kanonikal.
  const needsResolve =
    isFacebookShareShortLink(normalized) && initialKind === "post";
  const [resolvedUrl, setResolvedUrl] = useState(
    needsResolve ? null : normalized,
  );

  useEffect(() => {
    if (!needsResolve) return;
    let cancelled = false;
    api
      .get<{ url: string }>("/embed/facebook", { params: { url: normalized } })
      .then((res) => {
        if (!cancelled) setResolvedUrl(res.data.url || normalized);
      })
      .catch(() => {
        if (!cancelled) setResolvedUrl(normalized);
      });
    return () => {
      cancelled = true;
    };
  }, [needsResolve, normalized]);

  if (!resolvedUrl) {
    return (
      <div className="flex h-[220px] w-full max-w-[500px] items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
        Memuat embed Facebook…
      </div>
    );
  }

  return <FacebookEmbedView url={resolvedUrl} />;
}
