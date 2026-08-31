// components/ArticleContent.tsx
import React from "react";
import parse from "html-react-parser";
import { Tweet } from "react-tweet";
import { InstagramEmbed } from "react-social-media-embed";
import ReadAlso from "./ReadAlso";
import FacebookSocialEmbed from "./FacebookSocialEmbed";
import TikTokSocialEmbed from "./TikTokSocialEmbed";
import { decodeEmbedAttributeUrl } from "@/lib/social-embed-url";

type Platform = "twitter" | "instagram" | "facebook" | "tiktok";
interface PlatformConfig {
  Component: React.ComponentType<any>;
  getId: (url: string) => string | null;
  fallback: string;
}
const platformMap: Record<Platform, PlatformConfig> = {
  twitter: {
    Component: Tweet,
    getId: (url: string) => {
      // Extract tweet ID from URL
      const match = url.match(/status\/([0-9]+)/);
      return match ? match[1] : null;
    },
    fallback: "Twitter post tidak ditemukan",
  },
  instagram: {
    Component: InstagramEmbed,
    getId: (url: string) => url,
    fallback: "Instagram post tidak ditemukan",
  },
  facebook: {
    Component: FacebookSocialEmbed,
    getId: (url: string) => decodeEmbedAttributeUrl(url),
    fallback: "Facebook post tidak ditemukan",
  },
  tiktok: {
    Component: TikTokSocialEmbed,
    getId: (url: string) => decodeEmbedAttributeUrl(url),
    fallback: "TikTok post tidak ditemukan",
  },
};

export default function ArticleContent({
  htmlContent,
}: {
  htmlContent: string;
}) {
  return (
    <div className="article-content-body min-w-0">
      {parse(htmlContent, {
    replace: (domNode: any) => {
      // Handle "Baca Juga" node
      if (
        domNode.name === "div" &&
        domNode.attribs &&
        domNode.attribs["data-read-also"] === "true"
      ) {
        const slug = domNode.attribs["data-slug"];
        const title = domNode.attribs["data-title"];
        const publicPath = domNode.attribs["data-public-path"] || null;
        if (slug && title) {
          return (
            <ReadAlso slug={slug} title={title} publicPath={publicPath} />
          );
        }
        return null;
      }

      // Lazy-load gambar inline di body artikel
      if (domNode.name === "img" && domNode.attribs) {
        const { class: className, ...restAttribs } = domNode.attribs;
        const imgProps: React.ImgHTMLAttributes<HTMLImageElement> = {
          ...restAttribs,
          ...(className ? { className } : {}),
        };
        if (!imgProps.loading) {
          imgProps.loading = "lazy";
        }
        if (!imgProps.decoding) {
          imgProps.decoding = "async";
        }
        return <img {...imgProps} />;
      }

      // Handle social embed node
      if (
        domNode.name === "div" &&
        domNode.attribs &&
        domNode.attribs["data-social-embed"] === "true"
      ) {
        const platform = domNode.attribs["data-platform"] as Platform;
        const url = decodeEmbedAttributeUrl(domNode.attribs["data-url"]);
        const config = platformMap[platform];
        if (!config) return null;

        try {
          const id = config.getId(url);
          if (!id) throw new Error("Invalid URL");
          return (
            <div className="my-4 flex justify-center">
              <config.Component url={id} />
            </div>
          );
        } catch (e) {
          return (
            <div className="p-4 bg-red-50 text-red-500 rounded-lg text-center">
              {config.fallback}
            </div>
          );
        }
      }
    },
      })}
    </div>
  );
}
