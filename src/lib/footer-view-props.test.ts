import { describe, expect, it } from "vitest";
import {
  DEFAULT_FOOTER_COPYRIGHT,
  footerViewPropsFromConfigs,
} from "./footer-view-props";

describe("footerViewPropsFromConfigs", () => {
  it("uses default copyright and empty socials when configs are empty", () => {
    const props = footerViewPropsFromConfigs([]);
    expect(props.copyrightText).toBe(DEFAULT_FOOTER_COPYRIGHT);
    expect(props.socialLinks).toEqual([]);
  });

  it("maps social links from config keys", () => {
    const props = footerViewPropsFromConfigs([
      { key: "copyright_text", value: "Hak cipta uji." },
      { key: "social_instagram_link", value: "https://instagram.com/arasvara" },
      { key: "social_twitter_link", value: "https://x.com/arasvara" },
    ]);
    expect(props.copyrightText).toBe("Hak cipta uji.");
    expect(props.socialLinks.map((s) => s.icon)).toEqual(["instagram", "x"]);
  });
});
