import Link from "next/link";
import {
  User,
  Calendar,
  Facebook,
  Linkedin,
  Link2,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import { Button } from "../ui/button";
import ArticleContent from "./ArticleContent";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import NewsCard from "./NewsCard";
import { Article, ArticleListResponse } from "@/types/article";
import type { UserProfile } from "@/types/user";
import ButtonConnect from "../ui/ButtonConnect";
import XIcon from "../ui/XIcon";
import WaIcon from "../ui/WaIcon";
import TelegramIcon from "../ui/TelegramIcon";
import { getArticleShareLinks } from "@/lib/article-share";
import { resolveAuthorPublicHref } from "@/lib/author-public-path";
import { useState, useCallback, useMemo } from "react";
import Image from "next/image";
import GalleryContent from "./GalleryContent";
import TitleHomepage from "../homepage/TitleHomepage";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import SidebarSingleArticle, {
  SidebarContent,
} from "../sidebarPublic/SidebarSingleArticle";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import PopularNewsCarousel from "../homepage/carousel/PopularNewsCarousel";
import DividerHorizontal from "../homepage/DividerHorizontal";
import AdsCarousel from "../ads/carousel/AdsCarousel";
import { AdsCarouselVariant, type SingleArticleAdItem } from "@/types/ads";
import { singleArticleAdToCarouselItem } from "@/hooks/useAds";
import { useConfiguration } from "@/hooks/useConfiguration";
import NewsCarouselUi from "../homepage/carousel/NewsCarouselUi";
import SecondaryNewsCard from "./SecondaryNewsCard";
import LoadMoreButton from "@/components/ui/LoadMoreButton";

// const ArticleContent = dynamic(() => import("@/components/ArticleContent"), {
//   ssr: false,
// });

function userProfileAvatarSrc(
  avatar: UserProfile["avatar"],
): string | undefined {
  if (!avatar) return undefined;
  return typeof avatar === "string" ? avatar : avatar.url;
}

function AttributionPersonRow({ profile }: { profile: UserProfile }) {
  const src = userProfileAvatarSrc(profile.avatar);
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-10 h-10 shrink-0 rounded-full bg-muted flex items-center justify-center overflow-hidden">
        {src ? (
          <Avatar className="h-8 w-8">
            <AvatarImage src={src} alt={profile.name} />
            <AvatarFallback>{getInitials(profile.name)}</AvatarFallback>
          </Avatar>
        ) : (
          <User className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <p className="font-medium text-sm truncate">{profile.name}</p>
    </div>
  );
}

interface ArticleUiProps {
  article: Article;
  related?: ArticleListResponse[];
  shareUrl?: string;
  isPageAdmin?: boolean;
  copied?: boolean;
  handleCopy?: () => void;
  formatDateReadable: (date: string | Date) => string;
  formatTimeReadable: (date: string | Date) => string;
  isPreview?: boolean;
  currentPage?: number;
  totalPages?: number;
  isShowAll?: boolean;
  onPageChange?: (page: number | "all") => void;
  isForPublic?: boolean;
  /** Untuk blok "Earlier Stories"; dari parent (mis. NewsDetailClient). Tanpa prop ini, blok disembunyikan (mis. admin preview). */
  latestArticles?: Article[];
  isLoadingLatestArticles?: boolean;
  /** Iklan kontekstual halaman artikel (vertikal sidebar). */
  articleVerticalAd?: SingleArticleAdItem | null;
  /** Iklan carousel horizontal untuk blok iklan di bawah artikel. */
  articleHorizontalAds?: SingleArticleAdItem[];
  /** Sedang memuat iklan artikel dari React Query. */
  isLoadingArticleAds?: boolean;
}

const ArticleUi = ({
  article,
  shareUrl,
  isPageAdmin = false,
  copied,
  related,
  handleCopy,
  formatDateReadable,
  formatTimeReadable,
  isPreview = false,
  currentPage = 1,
  totalPages = 1,
  isShowAll = false,
  onPageChange,
  isForPublic = false,
  latestArticles,
  isLoadingLatestArticles = false,
  articleVerticalAd = null,
  articleHorizontalAds,
  isLoadingArticleAds = false,
}: ArticleUiProps) => {
  // ─── Sidebar Toggle ─────────────────────────────────────────────────────────
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const toggleSidebar = useCallback(
    () => setIsSidebarOpen((prev) => !prev),
    [],
  );
  const { getStringValue } = useConfiguration();
  const waConnected = getStringValue("whatsapp_channel");
  const tgConnected = getStringValue("telegram_group");

  const shareLinks = useMemo(
    () => (shareUrl ? getArticleShareLinks(shareUrl, article.title) : null),
    [shareUrl, article.title],
  );

  const authorHref = resolveAuthorPublicHref(article.author);
  const authorMetaContent = (
    <>
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
        {article.author.avatar ? (
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={
                typeof article.author.avatar === "string"
                  ? article.author.avatar
                  : article.author.avatar?.url
              }
            />
            <AvatarFallback>{getInitials(article.author.name)}</AvatarFallback>
          </Avatar>
        ) : (
          <User className="h-8 w-8" />
        )}
      </div>
      <div>
        <p
          className={`font-medium text-sm${authorHref ? " group-hover:text-hijauSawah transition-colors" : ""}`}
        >
          By {article.author.name}
        </p>
      </div>
    </>
  );

  const shareButtonClass =
    "p-2 rounded-full border border-border hover:bg-muted transition-colors";

  const contributorsFiltered = useMemo(
    () =>
      (article.contributors ?? []).filter(
        (p) => p && String(p.name ?? "").trim().length > 0,
      ),
    [article.contributors],
  );

  const showAuthor =
    Boolean(article.author) &&
    String(article.author?.name ?? "").trim().length > 0;
  const showEditor =
    Boolean(article.editor) &&
    String(article.editor?.name ?? "").trim().length > 0;
  const showContributors = contributorsFiltered.length > 0;
  const showAttributionBlock = showAuthor || showEditor || showContributors;

  const sidebarVerticalArticleAd = useMemo(
    () =>
      articleVerticalAd
        ? {
            adId: articleVerticalAd._id,
            bannerUrl: articleVerticalAd.banner.url,
            name: articleVerticalAd.name,
            linkUrl: articleVerticalAd.linkUrl,
          }
        : null,
    [articleVerticalAd],
  );

  /** Hanya iklan horizontal artikel yang aktif; tanpa fallback placeholder. */
  const horizontalCarouselAds = useMemo(() => {
    if (isLoadingArticleAds || !articleHorizontalAds?.length) return [];
    return articleHorizontalAds.map(singleArticleAdToCarouselItem);
  }, [isLoadingArticleAds, articleHorizontalAds]);


  return (
    <>
      {/* Article Content */}
      <article
        className={`mx-auto px-4 py-8 md:px-0 flex flex-col md:flex-row items-start container ${isForPublic ? "lg:max-w-6xl" : ""}`}
        style={{
          gap: isSidebarOpen ? "3rem" : "0",
          transition: "gap 500ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* Mobile Floating Trigger (Right Drawer) */}
        {isForPublic && (
          <div className="md:hidden fixed bottom-8 right-4 z-50">
            <Drawer direction="right">
              <DrawerTrigger asChild>
                <Button
                  variant={"outline"}
                  className="rounded-full w-10 h-10  pointer-events-auto"
                  aria-label="Buka navigasi artikel"
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
              </DrawerTrigger>
              <DrawerContent className="h-screen bottom-0 rounded-none z-10000">
                <DrawerHeader className="border-b">
                  <DrawerTitle className="text-left">
                    Navigasi Artikel
                  </DrawerTitle>
                </DrawerHeader>
                <div className="overflow-y-auto p-6 pb-20 h-full">
                  <SidebarContent
                    verticalArticleAd={sidebarVerticalArticleAd}
                  />
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        )}

        <div
          className={`${isForPublic ? (isSidebarOpen ? "md:w-3/4 w-full" : "w-full") : "max-w-3/4 mx-auto"} flex-1`}
          style={{
            transition: "width 500ms cubic-bezier(0.4, 0, 0.2, 1)",
            minWidth: 0,
          }}
        >
          <div className="relative w-full flex justify-between items-center mb-8">
            <Breadcrumb className="">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink className="text-base" href="/">
                    Home
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink
                    className="text-base "
                    href={`/category/${article.category.slug}`}
                  >
                    <Button
                      className="px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-lg"
                      variant={"outline"}
                    >
                      {article.category?.name || "-"}
                    </Button>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            {/* Sidebar toggle button — hanya tampil di halaman publik pada desktop */}
            {isForPublic && (
              <Button
                variant={"outline"}
                className="aspect-square rounded-full w-10 h-10 hidden md:flex"
                onClick={toggleSidebar}
                aria-label={isSidebarOpen ? "Tutup sidebar" : "Buka sidebar"}
              >
                <ChevronRight
                  className="w-4 h-4 transition-transform duration-300"
                  style={{
                    transform: isSidebarOpen
                      ? "rotate(0deg)"
                      : "rotate(180deg)",
                  }}
                />
              </Button>
            )}
          </div>

          <h1 className="font-serif  text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-6 pr-12">
            {article.title}
          </h1>

          {/* Featured Image */}
          {article.featuredImage && article.format === "STANDARD" && (
            <div className="mb-6">
              <div className="w-full relative rounded-2xl overflow-hidden">
                <Image
                  priority
                  unoptimized
                  width={1920}
                  height={1080}
                  src={article.featuredImage.url}
                  alt={article.featuredImage.caption || article.title}
                  className="object-cover w-full h-full"
                />
              </div>
              {article.featuredImage.caption && (
                <p className="text-sm italic text-center text-muted-foreground mt-2">
                  {article.featuredImage.caption}
                  {article.featuredImage.credit && (
                    <span className="not-italic ml-1 text-xs">
                      ({article.featuredImage.credit})
                    </span>
                  )}
                </p>
              )}
            </div>
          )}

          {article.format === "GALLERY" && (
            <GalleryContent
              featuredImage={article.featuredImage ?? null}
              galleryItems={article.galleryItems || []}
              content={article.content ?? ""}
            />
          )}

          {/* Meta */}
          <div className="flex flex-row flex-wrap items-center gap-4 mb-8 pb-8 border-b border-border">
            {authorHref ? (
              <Link
                href={authorHref}
                className="relative z-10 flex items-center gap-2 group"
              >
                {authorMetaContent}
              </Link>
            ) : (
              <div className="flex items-center gap-2">{authorMetaContent}</div>
            )}

            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Calendar className="h-4 w-4" />
              <span>
                {formatDateReadable(article.publishedAt || article.createdAt)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="h-4 w-4" />
              <span>
                {formatTimeReadable(article.publishedAt || article.createdAt)}
              </span>
            </div>
          </div>

          {shareLinks && (
            <div className="mb-8 flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium">Share:</span>
              <a
                href={shareLinks.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className={shareButtonClass}
                aria-label="Bagikan ke Facebook"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href={shareLinks.x}
                target="_blank"
                rel="noopener noreferrer"
                className={shareButtonClass}
                aria-label="Bagikan ke X"
              >
                <XIcon className="h-4 w-4" />
              </a>
              <a
                href={shareLinks.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className={shareButtonClass}
                aria-label="Bagikan ke LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </a>
              <a
                href={shareLinks.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className={shareButtonClass}
                aria-label="Bagikan ke WhatsApp"
              >
                <WaIcon className="h-4 w-4" />
              </a>
              <a
                href={shareLinks.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className={shareButtonClass}
                aria-label="Bagikan ke Telegram"
              >
                <TelegramIcon className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={handleCopy}
                className={`${shareButtonClass} relative`}
                aria-label="Salin tautan artikel"
              >
                <Link2 className="h-4 w-4" />
                {copied && (
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 rounded bg-foreground px-2 py-1 text-xs text-background">
                    Copied!
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Article Body — galeri merender konten di GalleryContent (di atas meta/editor) */}
          {article.format !== "GALLERY" && article.content && (
            <div className="prose-arasvara text-lg leading-relaxed text-start">
              <ArticleContent htmlContent={article.content} />
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && !isShowAll && (
            <div className="flex flex-col items-center gap-4 mt-10 mb-2">
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange?.(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange?.(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="gap-1"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange?.("all")}
                className=""
              >
                Tampilkan Semua Halaman
              </Button>
            </div>
          )}

          {/* Penulis, editor, kontributor — kartu disembunyikan jika tidak ada data */}
          {showEditor && article.editor && (
            <div className="p-4 rounded-xl border border-border w-fit min-w-3/5  md:min-w-64">
              <p className="font-semibold mb-3">Editor</p>
              <AttributionPersonRow profile={article.editor} />
            </div>
          )}

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="mt-8 pt-8 border-t border-border">
              <h3 className="text-sm font-semibold mb-3">Tags:</h3>
              <div className="flex flex-wrap gap-2">
                {isPreview
                  ? article.tags.map((tag) => (
                      <span
                        key={tag.name}
                        className="px-3 py-1 bg-muted rounded-full text-sm hover:bg-muted/80 transition-colors"
                      >
                        #{tag.name}
                      </span>
                    ))
                  : article.tags.map((tag) => (
                      <Link
                        key={tag.slug}
                        href={`/search?tags=${tag.slug}`}
                        className="px-3 py-1 bg-muted rounded-full text-sm hover:bg-muted/80 transition-colors"
                      >
                        #{tag.name}
                      </Link>
                    ))}
              </div>
            </div>
          )}

          {/* Tombol follow */}
          <section className="container mx-auto px-4 md:px-0 py-4">
            <div className="flex justify-center gap-8">
              {/* button wa channel */}
              <ButtonConnect href={waConnected} app="whatsapp" />
              {/* button telegram */}
              <ButtonConnect href={tgConnected} app="telegram" />
            </div>
          </section>

          {related && related.length > 0 && (
            <>
              {/* Divider */}
              <DividerHorizontal
                className={` container mx-auto px-4 md:px-0`}
              />

              {/* related */}
              <section className="container mx-auto px-4 md:px-0 py-4">
                <TitleHomepage title="Berita Terkait" variant="light" />

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {related?.map((article) => {
                    console.log(article);
                    return (
                      <SecondaryNewsCard key={article._id} article={article} />
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>

        {isForPublic && (
          <SidebarSingleArticle
            isOpen={isSidebarOpen}
            verticalArticleAd={sidebarVerticalArticleAd}
          />
        )}
      </article>

      {!isPageAdmin && (
        <>
          {/* Advertisement */}
          {horizontalCarouselAds && horizontalCarouselAds.length > 0 && (
            <section className="container mx-auto px-4 md:px-0 py-4">
              <div
                className={`${isForPublic ? "lg:max-w-6xl" : ""} mx-auto  text-center`}
              >
                <div className="w-full mt-8">
                  <AdsCarousel
                    variant={AdsCarouselVariant.HORIZONTAL_LONG}
                    ads={horizontalCarouselAds}
                  />
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* Divider */}
      <DividerHorizontal
        className={`${isForPublic ? "lg:max-w-6xl" : ""} container mx-auto px-4 md:px-0`}
      />

      {/* Popular carousel */}
      {isForPublic && (
        <>
          <div
            className={`${isForPublic ? "lg:max-w-6xl" : ""} container mx-auto px-4 md:px-0 py-8`}
          >
            <TitleHomepage title="Berita Terpopuler" variant="light" />

            <PopularNewsCarousel showAds={false} />
          </div>
          <DividerHorizontal
            className={`${isForPublic ? "lg:max-w-6xl" : ""} container mx-auto px-4 md:px-0`}
          />
        </>
      )}

      {/* latest — hanya jika parent menyalurkan data (halaman publik berita) */}
      {latestArticles !== undefined && (
        <section
          className={`${isForPublic ? "lg:max-w-6xl" : ""} container mx-auto px-4 md:px-0`}
        >
          <h2 className="text-3xl lg:text-4xl font-bold text-center w-full md:w-auto text-primary mb-8">
            Berita Terupdate
          </h2>

          {isLoadingLatestArticles ? (
            <p className="text-center text-muted-foreground py-8">
              Memuat berita terbaru…
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {latestArticles.map((story: Article) => (
                <NewsCard key={story._id} article={story} />
              ))}
            </div>
          )}

          <LoadMoreButton
            href="/indeks"
            variant="hijauSawah"
            wrapperClassName="flex justify-center w-full my-8"
          />
        </section>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            headline: article.title,
            description: article.excerpt,
            image: article.featuredImage,
            datePublished: article.publishedAt,
            dateModified: article.updatedAt,
            ...(shareUrl
              ? {
                  url: shareUrl,
                  mainEntityOfPage: {
                    "@type": "WebPage",
                    "@id": shareUrl,
                  },
                }
              : {}),
            author: {
              "@type": "Person",
              name: article.author.name,
            },
            publisher: {
              "@type": "Organization",
              name: "ARASVARA",
              logo: {
                "@type": "ImageObject",
                url: "https://arasvara.id/logo.png",
              },
            },
          }),
        }}
      />
    </>
  );
};
export default ArticleUi;
