/**
 * Server-rendered hero poster for LCP — plain <img> in initial HTML
 * (tanpa menunggu hidrasi client ResponsiveMediaImage).
 */
export default function HeroLcpPoster({
  src,
  srcSet,
}: {
  src: string;
  srcSet?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- LCP harus native img di SSR HTML
    <img
      src={src}
      srcSet={srcSet}
      sizes="100vw"
      alt=""
      fetchPriority="high"
      decoding="async"
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}
