import React from "react";
import Image from "next/image";
import { SectionVideoItem } from "@/types/articleSection";
import Link from "next/link";
import {
  getSocmedVideoAspectClass,
  type SocmedVideoLayout,
} from "@/lib/socmed-video-layout";
import { ImageNotFound } from "@/components/image-notfound/ImageNotFound";
import { shouldUnoptimizeNewsCardImage } from "@/lib/utils";
import { InstagramIcon, TikTokIcon } from "@/components/icon/SocmedIcon";

interface VideoCarouselItemProps {
  video: SectionVideoItem;
  span?: 1 | 2;
  layout: SocmedVideoLayout;
  /** Tampilkan logo platform di bawah card (hanya carousel socmed homepage). */
  showPlatformBadge?: boolean;
}

function resolveThumbnailUrl(video: SectionVideoItem): string {
  const fromField = video.thumbnail_url?.trim();
  if (fromField) return fromField;
  const fromMedia = video.thumbnail?.url?.trim();
  if (fromMedia) return fromMedia;
  return "";
}

/**
 * Komponen item video untuk carousel sosial media.
 * Rasio dinamis (9:16 / 16:9 dan varian span 2) berdasarkan layout platform.
 */
const VideoCarouselItem: React.FC<VideoCarouselItemProps> = ({
  video,
  span = 1,
  layout,
  showPlatformBadge = false,
}) => {
  const aspectClass = getSocmedVideoAspectClass(layout, span);
  const thumbnailUrl = resolveThumbnailUrl(video);
  const [imageFailed, setImageFailed] = React.useState(false);

  React.useEffect(() => {
    setImageFailed(false);
  }, [thumbnailUrl, video._id]);

  const showImageFallback = !thumbnailUrl || imageFailed;

  const platformBadge =
    showPlatformBadge && video.type !== "youtube" ? (
      <div
        className="flex justify-center pt-2 md:pt-4 transition-transform duration-300 ease-out group-hover:-translate-y-1.5"
        aria-label={video.type === "tiktok" ? "TikTok" : "Instagram"}
      >
        {video.type === "tiktok" ? (
          <TikTokIcon className="h-8 w-8 text-white/80" />
        ) : (
          <InstagramIcon className="h-8 w-8 text-white/80" />
        )}
      </div>
    ) : null;

  return (
    <div className="group flex w-full flex-col">
      <Link
        href={video.video_url}
        target="_blank"
        rel="noopener noreferrer"
        className={`relative block w-full rounded-2xl overflow-hidden cursor-pointer shrink-0 ${aspectClass}`}
        title={video.title}
        aria-label={`Tonton video: ${video.title}`}
      >
        <div className="absolute inset-0 w-full h-full transition-transform duration-300 ease-out group-hover:scale-105">
          {showImageFallback ? (
            <ImageNotFound
              fill
              variant="dark"
              className="border-0 shadow-none rounded-2xl"
            />
          ) : (
            <Image
              src={thumbnailUrl}
              alt={video.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 28vw"
              onError={() => setImageFailed(true)}
              unoptimized={shouldUnoptimizeNewsCardImage(thumbnailUrl)}
            />
          )}
        </div>

        <div className="absolute bottom-0 pt-4 left-0 right-0 p-3 bg-linear-to-t from-black/70 to-transparent z-10">
          <p className="text-white text-sm font-medium line-clamp-2">
            {video.title}
          </p>
        </div>

        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="flex items-center justify-center w-14 h-14 md:w-16 md:h-16 bg-white/30 backdrop-blur-md rounded-full text-white transition-transform duration-300 scale-0 group-hover:scale-110 group-hover:bg-primary/90">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 24 24"
              className="w-8 h-8 ml-1"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653Z"
              />
            </svg>
          </div>
        </div>
      </Link>
      {platformBadge}
    </div>
  );
};

export default VideoCarouselItem;
