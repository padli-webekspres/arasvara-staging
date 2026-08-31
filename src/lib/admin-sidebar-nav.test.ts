import { describe, expect, it } from "vitest";
import { adminPanelHref } from "@/lib/admin-panel-path";
import { isAdminNavActive } from "@/lib/admin-sidebar-nav";

const semuaArtikel = adminPanelHref("articles");
const moderasi = adminPanelHref("articles/approval");
const tulisNaskah = adminPanelHref("articles/new");

describe("isAdminNavActive", () => {
  it("exact-match list Moderasi & Rilis", () => {
    expect(isAdminNavActive(moderasi, moderasi)).toBe(true);
    expect(isAdminNavActive(`${moderasi}/`, moderasi)).toBe(true);
  });

  it("aktif di halaman approval nested", () => {
    const nested = adminPanelHref(
      "articles/ramalan-shio-kelinci-dan-kuda-jumat-7-agustus-2026-hati-hati-dalam-mengelola-keuangan/approval",
    );
    expect(isAdminNavActive(nested, moderasi)).toBe(true);
    expect(isAdminNavActive(nested, semuaArtikel)).toBe(false);
  });

  it("tidak aktif di daftar atau edit artikel", () => {
    expect(isAdminNavActive(semuaArtikel, moderasi)).toBe(false);
    expect(
      isAdminNavActive(adminPanelHref("articles/some-slug"), moderasi),
    ).toBe(false);
    expect(isAdminNavActive(tulisNaskah, moderasi)).toBe(false);
  });
});
