import { NextResponse } from "next/server";
import { buildNewsSitemapXml, getSitemapBaseUrl } from "@/lib/sitemap-xml";
import { getSitemapArticles } from "@/services/sitemapService";

/** Rentang artikel yang dimasukkan ke sitemap news (48 jam terakhir sesuai panduan Google News). */
const NEWS_SITEMAP_MAX_AGE_HOURS = 48;

/** Batas maksimal URL per sitemap Google News. */
const NEWS_SITEMAP_MAX_URLS = 1000;

export async function GET() {
	const baseUrl = getSitemapBaseUrl();

	try {
		const articles = await getSitemapArticles({
			maxAgeHours: NEWS_SITEMAP_MAX_AGE_HOURS,
		});
		const xml = buildNewsSitemapXml(
			baseUrl,
			articles.slice(0, NEWS_SITEMAP_MAX_URLS),
		);

		return new NextResponse(xml, {
			headers: {
				"Content-Type": "application/xml; charset=utf-8",
				"Cache-Control": "public, max-age=120, s-maxage=120",
			},
		});
	} catch (error) {
		console.error("[sitemap_news.xml] Gagal membangun sitemap news:", error);
		return new NextResponse("Gagal memuat sitemap news", { status: 500 });
	}
}
