"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Article, ArticleListResponse } from "@/types/article";
import { ImageNotFound } from "@/components/image-notfound/ImageNotFound";
import { shouldUnoptimizeNewsCardImage } from "@/lib/utils";
import { resolvePublicArticleHref } from "@/lib/article-public-path";

interface TersierNewsCardProps {
  article: Article | ArticleListResponse;
}

const TersierNewsCard = ({ article }: TersierNewsCardProps) => {
  const imageUrl = article.featuredImage?.url?.trim() ?? "";
  const [imageFailed, setImageFailed] = React.useState(false);

  React.useEffect(() => {
    setImageFailed(false);
  }, [imageUrl, article.slug]);

  const showImageFallback = !imageUrl || imageFailed;
  const hasImage = !showImageFallback;

  let title = article.title || "";
  let highlight = "";
  let main = title;
  const match = title.match(/(.+)([.!?]\s+[^.!?]+)$/);
  if (match) {
    main = match[1];
    highlight = match[2];
  } else if (title.includes(" ")) {
    const idx = title.lastIndexOf(" ");
    main = title.slice(0, idx);
    highlight = title.slice(idx);
  }

  return (
    <Link
      href={resolvePublicArticleHref(article)}
      className="block group relative rounded-2xl overflow-hidden shadow-lg w-full h-full"
    >
      <div className="relative w-full h-full">
        {showImageFallback ? (
          <ImageNotFound
            fill
            variant="light"
            className="border-0 shadow-none"
          />
        ) : (
          <Image
            src={imageUrl}
            alt={article.title}
            fill
            className="object-cover w-full h-full"
            sizes="(max-width: 768px) 100vw, 50vw"
            onError={() => setImageFailed(true)}
            unoptimized={shouldUnoptimizeNewsCardImage(imageUrl)}
          />
        )}
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-transparent" />
        {/* Text overlay */}
        <div className="absolute inset-0 flex items-end">
          <div className="p-6 md:p-10 w-full">
            <p
              className={`text-white text-xl md:text-2xl font-semibold leading-snug drop-shadow-lg ${
                hasImage ? "line-clamp-3" : "line-clamp-2"
              }`}
            >
              {main}
              {highlight && (
                <span className="bg-orange-500/90 px-2 py-0.5 rounded text-white ml-1 font-bold inline-block">
                  {highlight.trim()}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default TersierNewsCard;
