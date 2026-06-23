/**
 * Injeksi loading="lazy" pada tag img di HTML artikel (pure function untuk test).
 */
export function injectLazyLoadOnArticleImages(html: string): string {
  if (!html?.trim()) return html ?? "";

  return html.replace(/<img\b([^>]*)>/gi, (match, attrs: string) => {
    if (/\bloading\s*=/i.test(attrs)) {
      return match;
    }
    return `<img loading="lazy" decoding="async"${attrs}>`;
  });
}
