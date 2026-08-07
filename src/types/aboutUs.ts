// ── Tipe untuk satu anggota redaksi ──────────────────────────────────────────
export interface EditorialMember {
  name: string;
  order: number;
}

// ── Tipe untuk struktur redaksi (dari data statis) ────────────────────────────
export interface EditorialStructure {
  order: number;
  role: string;
  member: EditorialMember[];
}

// ── Tipe untuk struktur redaksi dari konfigurasi admin (DnD) ─────────────────
export interface RedaksiPerson {
  id: string;
  name: string;
}

export interface RedaksiPosition {
  id: string;
  position: string;
  people: RedaksiPerson[];
}

// ── Tipe untuk section CTA (Call to Action) ──────────────────────────────────
export interface AboutUsSection {
  title?: string;
  description?: string;
  link_button?: string;
  button_text?: string;
}

// ── Tipe untuk kontak ─────────────────────────────────────────────────────────
export interface Contact {
  name: string;
  value: string;
  link?: string;
}

// ── Kumpulan data About Us yang di-fetch dari konfigurasi ─────────────────────
export interface AboutUsData {
  // Hero video (sama dengan homepage)
  heroVideoUrl?: string;
  heroVideoPosterUrl?: string;

  // Profil & Deskripsi
  tagline?: string;
  subTagline?: string;
  aboutUsText?: string;

  // Visi & Misi
  visi?: string;
  misi?: string;

  // Struktur Redaksi
  titleRedaksi?: string;
  redaksiPositions: RedaksiPosition[];

  // Sections CTA
  sections: AboutUsSection[];

  // Quotes
  quotes?: string;
  quotesOwner?: string;

  // Meet Us
  titleMeetUs?: string;
  descMeetUs?: string;
  linkGmaps?: string;

  // Kontak & Sosial Media
  address?: string;
  email?: string;
  phone?: string;
  fax?: string;
  instagramLink?: string;
  facebookLink?: string;
  twitterLink?: string;
}
