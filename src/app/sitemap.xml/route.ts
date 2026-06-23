import { NextResponse } from "next/server";
import { buildSitemapXml, getSitemapBaseUrl } from "@/lib/sitemap-xml";
import { getSitemapData } from "@/services/sitemapService";

export async function GET() {
	const baseUrl = getSitemapBaseUrl();

	try {
		const { articles, categories } = await getSitemapData();
		const xml = buildSitemapXml(baseUrl, articles, categories);

		return new NextResponse(xml, {
			headers: {
				"Content-Type": "application/xml; charset=utf-8",
				"Cache-Control": "public, max-age=3600, s-maxage=3600",
			},
		});
	} catch (error) {
		console.error("[sitemap.xml] Gagal membangun sitemap:", error);
		return new NextResponse("Gagal memuat sitemap", { status: 500 });
	}
}
