import HeroCard from "@/components/news/HeroCard";
import { Article, ArticleListResponse } from "@/types/article";

interface ArticleFeaturedHeroProps {
  articles: (Article | ArticleListResponse)[];
  gaClickLocation?: string;
}

/**
 * Hero statis 3:2 (proporsi desktop HeadlineSlider) untuk 1–2 artikel unggulan.
 */
export default function ArticleFeaturedHero({
  articles,
  gaClickLocation,
}: ArticleFeaturedHeroProps) {
  if (!articles[0]) return null;

  return (
    <div className="mb-12 overflow-hidden rounded-xl">
      <div
        className={`flex flex-col gap-4 ${
          articles[1] ? "lg:h-[500px] lg:flex-row" : "h-[400px] lg:h-[500px]"
        }`}
      >
        <div
          className={`min-w-0 ${
            articles[1] ? "h-[400px] lg:h-full lg:flex-3" : "h-full w-full"
          }`}
        >
          <HeroCard
            article={articles[0]}
            variant="dark"
            size="full"
            gaClickLocation={gaClickLocation}
            gaPosition={1}
          />
        </div>
        {articles[1] && (
          <div className="h-[400px] min-w-0 lg:h-full lg:flex-2">
            <HeroCard
              article={articles[1]}
              variant="dark"
              size="full"
              gaClickLocation={gaClickLocation}
              gaPosition={2}
            />
          </div>
        )}
      </div>
    </div>
  );
}
