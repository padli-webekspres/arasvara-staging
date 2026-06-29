"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArticleListResponse } from "@/types/article";
import { cn } from "@/lib/utils";
import { ImageNotFound } from "@/components/image-notfound/ImageNotFound";
import { formatPublishedAtForUi } from "@/lib/format-published-at";
import { shouldUnoptimizeNewsCardImage } from "@/lib/utils";
import { resolvePublicArticleHref } from "@/lib/article-public-path";
import { resolveAuthorPublicHref } from "@/lib/author-public-path";
import { trackSelectContent } from "@/lib/ga-events";

interface SecondaryNewsCardProps {
  article: ArticleListResponse;
  showImage?: boolean;
  className?: string;
  hasPadding?: boolean;
  gaClickLocation?: string;
  gaPosition?: number;
}

const SecondaryNewsCard = ({
  article,
  showImage = true,
  className,
  hasPadding = false,
  gaClickLocation,
  gaPosition,
}: SecondaryNewsCardProps) => {
  const imageUrl = article?.featuredImage?.url?.trim() ?? "";
  const [imageFailed, setImageFailed] = React.useState(false);

  React.useEffect(() => {
    setImageFailed(false);
  }, [imageUrl, article?.slug]);

  const showImageFallback = !imageUrl || imageFailed;
  const hasImage = showImage && !showImageFallback;

  if (!article || typeof article !== "object") {
    return (
      <div className="p-4 text-sm text-muted-foreground border border-border rounded-lg">
        Artikel tidak ditemukan atau data tidak valid.
      </div>
    );
  }

  const authorHref = resolveAuthorPublicHref(article.author);

  return (
    <div className={cn("relative group", className)}>
      <article className="space-y-1">
        {showImage && (
          <div
            className="relative overflow-hidden rounded-lg aspect-video w-full mb-3"
          >
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
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 300px"
                onError={() => setImageFailed(true)}
                unoptimized={shouldUnoptimizeNewsCardImage(imageUrl)}
              />
            )}
          </div>
        )}

        <div className={cn(hasPadding && "pb-2 px-2 lg:pb-3 lg:px-3")}>
          <div className="flex gap-2 items-center">
            {article.category && article.category.name ? (
              <span className="text-xs font-semibold uppercase tracking-wider text-hijauSawah block">
                {article.category.name}
              </span>
            ) : null}
          </div>

          <h3
            className={cn(
              "font-bold leading-tight group-hover:text-hijauSawah transition-colors text-base lg:text-lg",
              hasImage ? "line-clamp-3" : "line-clamp-2",
            )}
          >
            <Link
              href={resolvePublicArticleHref(article)}
              className="after:absolute after:inset-0 after:z-0"
              onClick={gaClickLocation ? () => trackSelectContent({
                article_id: String(article._id ?? ""),
                article_slug: article.slug ?? "",
                article_title: article.title ?? "",
                category_name: article.category?.name ?? "",
                click_location: gaClickLocation,
                position: gaPosition,
              }) : undefined}
            >
              {article.title}
            </Link>
          </h3>

          {article.excerpt && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              {article.excerpt}
            </p>
          )}

          <div className="flex flex-row justify-start lg:justify-between">
            {authorHref ? (
              <Link
                href={authorHref}
                className="relative z-10 text-xs text-muted-foreground hover:text-hijauSawah mt-1"
              >
                By {(article.author && article.author.name) || "ARASVARA"}
              </Link>
            ) : (
              <span className="text-xs text-muted-foreground mt-1">
                By {(article.author && article.author.name) || "ARASVARA"}
              </span>
            )}
            <p className="text-xs text-muted-foreground mt-1 hidden lg:inline">
              {formatPublishedAtForUi(article.publishedAt)}
            </p>
          </div>
        </div>
      </article>
    </div>
  );
};

export default SecondaryNewsCard;
