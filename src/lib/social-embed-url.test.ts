import { describe, expect, it } from "vitest";
import {
  classifyFacebookUrl,
  decodeEmbedAttributeUrl,
  facebookPluginSrc,
  isFacebookShareShortLink,
  normalizeFacebookUrl,
  parseTikTokVideoId,
  tiktokEmbedSrc,
  tiktokOembedRequestUrl,
} from "@/lib/social-embed-url";

const marketplaceUrl =
  "https://www.facebook.com/marketplace/item/1025122126932475/?ref=browse_tab&amp;referral_code=marketplace_top_picks&amp;referral_story_type=top_picks";

describe("social-embed-url", () => {
  it("decodes HTML entities in stored data-url", () => {
    expect(decodeEmbedAttributeUrl(marketplaceUrl)).toContain(
      "&referral_code=",
    );
  });

  it("classifies Marketplace listings as marketplace, not post", () => {
    expect(classifyFacebookUrl(marketplaceUrl)).toBe("marketplace");
  });

  it("classifies standard posts and videos", () => {
    expect(
      classifyFacebookUrl(
        "https://www.facebook.com/andrewismusic/posts/451971596293956",
      ),
    ).toBe("post");
    expect(
      classifyFacebookUrl("https://www.facebook.com/watch/?v=123456"),
    ).toBe("video");
    expect(
      classifyFacebookUrl("https://www.facebook.com/page/videos/123456"),
    ).toBe("video");
  });

  it("strips tracking params when normalizing", () => {
    const normalized = normalizeFacebookUrl(marketplaceUrl);
    expect(normalized).not.toContain("referral_code");
    expect(normalized).toContain("/marketplace/item/1025122126932475");
  });

  it("builds plugin URLs with encoded href", () => {
    const src = facebookPluginSrc(
      "https://www.facebook.com/user/posts/1",
      "post",
    );
    expect(src).toContain("plugins/post.php");
    expect(src).toContain(encodeURIComponent("https://www.facebook.com/user/posts/1"));
  });

  it("parses TikTok video id and uses embed/v2, not player/v1", () => {
    const raw =
      "https://www.tiktok.com/@duabelasstigaa0/video/7625588888798645511?is_from_webapp=1&amp;sender_device=pc";
    expect(parseTikTokVideoId(raw)).toBe("7625588888798645511");
    expect(tiktokEmbedSrc("7625588888798645511")).toBe(
      "https://www.tiktok.com/embed/v2/7625588888798645511",
    );
    expect(tiktokEmbedSrc("7625588888798645511")).not.toContain("player/v1");
  });

  it("returns null for TikTok short links without a video id", () => {
    expect(parseTikTokVideoId("https://vm.tiktok.com/ZMabcdef/")).toBeNull();
  });

  it("builds TikTok oEmbed request URL from canonical video URL", () => {
    const canonical =
      "https://www.tiktok.com/@duabelasstigaa0/video/7625588888798645511";
    expect(tiktokOembedRequestUrl(canonical)).toContain(
      encodeURIComponent(canonical),
    );
  });

  it("classifies reels and /share/v/ as reel, not plugin video", () => {
    const share = "https://www.facebook.com/share/v/1BrBbAZ7nM/";
    expect(classifyFacebookUrl(share)).toBe("reel");
    expect(
      classifyFacebookUrl("https://www.facebook.com/reel/1383526353228574/"),
    ).toBe("reel");
    expect(isFacebookShareShortLink(share)).toBe(true);
    expect(
      isFacebookShareShortLink(
        "https://www.facebook.com/reel/1383526353228574/",
      ),
    ).toBe(false);
  });
});
