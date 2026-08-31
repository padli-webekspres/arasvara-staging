import { NextResponse } from "next/server";

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://arasvara.id";

  const adminPanelBasePath =
    process.env.NEXT_PUBLIC_ADMIN_PANEL_PATH || "admin";
  const robotsTxt = `# ARASVARA News - robots.txt
User-agent: *
Allow: /

# Disallow admin pages
Disallow: /${adminPanelBasePath}/
Disallow: /api/
Disallow: /login
Disallow: /register
Disallow: /search
Disallow: /search/

# Sitemaps
Sitemap: ${baseUrl}/sitemap.xml
Sitemap: ${baseUrl}/sitemap_news.xml

# Crawl-delay
Crawl-delay: 1
`;

  return new NextResponse(robotsTxt, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
