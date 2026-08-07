"use client";

import React from "react";
import Link from "next/link";
import { ResponsiveMediaImage } from "@/components/ui/ResponsiveMediaImage";
import { cn } from "@/lib/utils";
import { resolvePublicArticleHref } from "@/lib/article-public-path";
import { ImageNotFound } from "@/components/image-notfound/ImageNotFound";

export interface TopicArticleMock {
  title: string;
  slug: string;
  publicPath?: string | null;
  author: string;
  imageUrl: string;
}

interface TopicNewsCardProps {
  article: TopicArticleMock;
  className?: string;
}

const TopicNewsCard = ({ article, className }: TopicNewsCardProps) => {
  const [imageFailed, setImageFailed] = React.useState(false);
  const imageUrl = article.imageUrl?.trim() ?? "";
  const showImageFallback = !imageUrl || imageFailed;

  React.useEffect(() => {
    setImageFailed(false);
  }, [imageUrl, article.slug]);

  return (
    <Link
      href={resolvePublicArticleHref(article)}
      className={cn("block group w-full", className)}
    >
      <article className="flex flex-col w-full">
        {/* Cover Image container with aspect-video (16:9) */}
        <div className="relative overflow-hidden rounded-lg aspect-video w-full mb-3 bg-muted">
          {showImageFallback ? (
            <ImageNotFound
              fill
              variant="light"
              className="border-0 shadow-none"
            />
          ) : (
            <ResponsiveMediaImage
              src={imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 30vw, 400px"
              onError={() => setImageFailed(true)}
            />
          )}
        </div>

        {/* Article content (Title & Author) */}
        <div className="flex flex-col">
          <h3 className="font-bold text-base md:text-md leading-snug text-foreground group-hover:text-hijauSawah transition-colors duration-300 line-clamp-3">
            {article.title}
          </h3>
          <p className="text-[11px] font-medium text-muted-foreground mt-2 tracking-wide uppercase">
            By {article.author}
          </p>
        </div>
      </article>
    </Link>
  );
};

export default TopicNewsCard;
