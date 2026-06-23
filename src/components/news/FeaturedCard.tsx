"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { shouldUnoptimizeNewsCardImage } from "@/lib/utils";
import { resolvePublicArticleHref } from "@/lib/article-public-path";

interface FeaturedCardProps {
  article: {
    slug: string;
    publicPath?: string | null;
    featuredImage?: string;
    title: string;
    category: { name: string };
    excerpt?: string;
    authorName?: string;
  };
}

const FeaturedCard = ({ article }: FeaturedCardProps) => {
  return (
    <Link href={resolvePublicArticleHref(article)} className="block group">
      <article className="news-card-light h-full">
        <div className="relative aspect-4/3 overflow-hidden">
          {(() => {
            const src = article.featuredImage || "/placeholder.jpg";
            const isUnoptimized = shouldUnoptimizeNewsCardImage(src);
            return (
              <Image
                src={src}
                alt={article.title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105 rounded-lg"
                sizes="(max-width: 768px) 100vw, 25vw"
                {...(isUnoptimized ? { unoptimized: true } : {})}
              />
            );
          })()}
        </div>

        <div className="py-4">
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="category-tag category-tag-light">
              {article.category.name}
            </span>
          </div>

          <h3 className="text-xl font-bold text-primary leading-tight line-clamp-2 mb-2">
            {article.title}
          </h3>

          <p className=" text-gray-700 line-clamp-2 mb-3">{article.excerpt}</p>

          <p className="text-base text-primary/75 font-semibold">
            By {article.authorName || "ARASVARA"}
          </p>
        </div>
      </article>
    </Link>
  );
};

export default FeaturedCard;
