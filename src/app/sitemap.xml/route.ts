import { NextResponse } from "next/server";
import { buildSitemapXml, getSitemapBaseUrl } from "@/lib/sitemap-xml";
import { getSitemapData } from "@/services/sitemapService";

export async function GET() {
	const baseUrl = getSitemapBaseUrl();

	try {
		const { articles, categories, authors } = await getSitemapData();
		const xml = buildSitemapXml(baseUrl, articles, categories, authors);

		return new NextResponse(xml, {
			headers: {
				"Content-Type": "application/xml; charset=utf-8",
				"Cache-Control": "public, max-age=300, s-maxage=300",
			},
		});
	} catch (error) {
		console.error("[sitemap.xml] Gagal membangun sitemap:", error);
		return new NextResponse("Gagal memuat sitemap", { status: 500 });
	}
}
