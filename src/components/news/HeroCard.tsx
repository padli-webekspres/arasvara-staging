"use client";

import React from "react";
import { useHeroCardSplitText } from "@/hooks/animation/useHeroCardSplitText";
import Link from "next/link";
import { ResponsiveMediaImage } from "@/components/ui/ResponsiveMediaImage";
import UserAvatar from "@/components/users/AvatarUser";
import { Article, ArticleListResponse } from "@/types/article";
import { ImageNotFound } from "@/components/image-notfound/ImageNotFound";
import { resolvePublicArticleHref } from "@/lib/article-public-path";
import { trackSelectContent } from "@/lib/ga-events";

interface HeroCardProps {
  article: Article | ArticleListResponse;
  variant?: "dark" | "light";
  size?: "large" | "small" | "full";
  gaClickLocation?: string;
  gaPosition?: number;
  /** Default 2 (kategori/penulis). Homepage di bawah judul seksi h2 pakai 3. */
  headingLevel?: 2 | 3;
}

const HeroCard = ({
  article,
  variant = "dark",
  size = "large",
  gaClickLocation,
  gaPosition,
  headingLevel = 2,
}: HeroCardProps) => {
  const isDark = variant === "dark";
  const splitTextRef = useHeroCardSplitText(article.slug);
  const TitleTag = headingLevel === 3 ? "h3" : "h2";

  const imageUrl = article.featuredImage?.url?.trim() ?? "";
  const [imageFailed, setImageFailed] = React.useState(false);

  React.useEffect(() => {
    setImageFailed(false);
  }, [imageUrl, article.slug]);

  const showImageFallback = !imageUrl || imageFailed;

  return (
    <Link
      href={resolvePublicArticleHref(article)}
      className="block group h-full"
      draggable="false"
      onClick={
        gaClickLocation
          ? () =>
              trackSelectContent({
                article_id: String(article._id ?? ""),
                article_slug: article.slug ?? "",
                article_title: article.title ?? "",
                category_name: article.category?.name ?? "",
                click_location: gaClickLocation,
                position: gaPosition,
              })
          : undefined
      }
    >
      {" "}
      {/* Tambahkan h-full */}
      <div
        ref={splitTextRef}
        className={`relative overflow-hidden rounded-lg ${
          size === "large"
            ? "h-100 lg:h-150"
            : size === "full"
              ? "h-full w-full"
              : "h-75 lg:h-100"
        }`}
      >
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
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 92vw, 50vw"
            onError={() => setImageFailed(true)}
          />
        )}
        <div
          className={`absolute inset-y-0 w-2/3 left-0 ${
            isDark
              ? "bg-linear-to-r from-black/80 via-black/50 to-transparent"
              : "bg-linear-to-r from-white/80 via-white/50 to-transparent"
          }`}
        />
        <div className="absolute inset-0 flex flex-col justify-center p-6 pl-10 lg:pl-14">
          <div className="w-2/3 max-w-2/3 min-w-0 flex flex-col">
            <div className="flex flex-wrap gap-2 mb-3">
              {article.category && (
                <span className="inline-block px-3 py-1 text-xs uppercase font-semibold tracking-wider rounded-lg text-white border border-white">
                  {article.category.name}
                </span>
              )}
            </div>

            <div
              className={`mb-3 overflow-hidden ${
                size === "large" || size === "full"
                  ? "max-h-[10.5rem] lg:max-h-[13rem]"
                  : "max-h-[8.5rem] lg:max-h-[10.5rem]"
              }`}
            >
              <TitleTag
                className={`titleHeroCard w-full font-bold leading-snug relative ${
                  isDark ? "text-white" : "text-foreground"
                } ${
                  size === "large" || size === "full"
                    ? "text-2xl lg:text-3xl"
                    : "text-xl lg:text-2xl"
                }`}
              >
                {article.title}
              </TitleTag>
            </div>

            {article.excerpt && (
              <p
                className={`text-sm lg:text-base mb-4 line-clamp-2 ${
                  isDark ? "text-gray-300" : "text-muted-foreground"
                }`}
              >
                {article.excerpt}
              </p>
            )}

            <div className="flex flex-row items-center gap-2 lg:gap-3">
              <UserAvatar
                avatar={article.author?.avatar}
                name={article.author?.name || "ARASVARA"}
                className="w-8 h-8"
              />
              <p
                className={`text-sm font-medium ${isDark ? "text-gray-400" : "text-muted-foreground"}`}
              >
                By {article.author?.name || "ARASVARA"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default HeroCard;
