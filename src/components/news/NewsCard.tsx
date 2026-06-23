"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Article, ArticleListResponse } from "@/types/article";
import { ImageNotFound } from "@/components/image-notfound/ImageNotFound";
import { formatPublishedAtForUi } from "@/lib/format-published-at";
import { shouldUnoptimizeNewsCardImage } from "@/lib/utils";
import { resolvePublicArticleHref } from "@/lib/article-public-path";

interface NewsCardProps {
  article: Article | ArticleListResponse;
  showImage?: boolean;
  showExcerpt?: boolean;
  showAuthor?: boolean;
  showPublishedDate?: boolean;
}

const NewsCard = ({
  article,
  showImage = true,
  showExcerpt = true,
  showAuthor = true,
  showPublishedDate = false,
}: NewsCardProps) => {
  const imageUrl = article.featuredImage?.url?.trim() ?? "";
  const [imageFailed, setImageFailed] = React.useState(false);

  React.useEffect(() => {
    setImageFailed(false);
  }, [imageUrl, article.slug]);

  const showImageFallback = !imageUrl || imageFailed;
  const hasImage = showImage;

  return (
    <div className="relative group">
      <article className="flex flex-col md:flex-row gap-4 md:gap-6 items-start ">
        {showImage && (
          <div className="relative overflow-hidden rounded-lg aspect-video shrink-0 w-full md:w-[35%] lg:w-[40%]">
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
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 40vw, 500px"
                onError={() => setImageFailed(true)}
                unoptimized={shouldUnoptimizeNewsCardImage(imageUrl)}
              />
            )}
          </div>
        )}

        <div className="flex-1 flex flex-col justify-center py-1">
          {article.category && (
            <p className="text-sm font-semibold uppercase tracking-wider text-hijauSawah mb-1.5">
              {article.category.name}
            </p>
          )}

          <h3
            className={`font-bold leading-tight group-hover:text-hijauSawah transition-colors text-base lg:text-lg ${
              hasImage ? "line-clamp-3" : "line-clamp-2"
            }`}
          >
            <Link
              href={resolvePublicArticleHref(article)}
              className="after:absolute after:inset-0 after:z-0"
            >
              {article.title}
            </Link>
          </h3>

          {showExcerpt && article.excerpt && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              {article.excerpt}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            {showAuthor && (
              <Link
                href={`/author/${article.author._id}`}
                className="relative z-10 text-xs text-muted-foreground hover:text-hijauSawah"
              >
                By {article.author.name || "ARASVARA"}
              </Link>
            )}
            {showAuthor && showPublishedDate && (
              <span className="text-muted-foreground">|</span>
            )}
            {showPublishedDate && (
              <p className="text-xs text-muted-foreground">
                {formatPublishedAtForUi(article.publishedAt)}
              </p>
            )}
          </div>
        </div>
      </article>
    </div>
  );
};

export default NewsCard;
