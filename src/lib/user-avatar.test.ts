import { describe, expect, it } from "vitest";
import { resolveUserAvatarUrl } from "@/lib/user-avatar";

describe("resolveUserAvatarUrl", () => {
  it("returns undefined for empty or missing avatar", () => {
    expect(resolveUserAvatarUrl(undefined)).toBeUndefined();
    expect(resolveUserAvatarUrl(null)).toBeUndefined();
    expect(resolveUserAvatarUrl("")).toBeUndefined();
    expect(resolveUserAvatarUrl("   ")).toBeUndefined();
    expect(resolveUserAvatarUrl({ _id: "1", url: "", filename: "", mimetype: "", size: 0, createdAt: "", updatedAt: "" })).toBeUndefined();
  });

  it("returns absolute http(s) URLs as-is", () => {
    expect(resolveUserAvatarUrl("https://cdn.example.com/avatar.png")).toBe(
      "https://cdn.example.com/avatar.png",
    );
  });

  it("returns proxy path for admin media view URLs", () => {
    expect(resolveUserAvatarUrl("/api/media/view?key=avatars%2Fuser.png")).toBe(
      "/api/media/view?key=avatars%2Fuser.png",
    );
  });

  it("returns avatar proxy path for avatar bucket URLs", () => {
    expect(
      resolveUserAvatarUrl("/api/media/avatar/view?key=abc123.webp"),
    ).toBe("/api/media/avatar/view?key=abc123.webp");
  });

  it("builds avatar proxy URL from filename when url is missing", () => {
    expect(
      resolveUserAvatarUrl({
        _id: "1",
        url: "",
        filename: "abc123.webp",
        mimetype: "image/webp",
        size: 100,
        createdAt: "",
        updatedAt: "",
      }),
    ).toBe("/api/media/avatar/view?key=abc123.webp");
  });
});
