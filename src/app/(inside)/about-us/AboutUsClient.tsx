"use client";

import SectionText from "@/components/aboutUs/SectionText";
import Footer from "@/components/Footer";
import DividerHorizontal from "@/components/homepage/DividerHorizontal";
import { Button } from "@/components/ui/button";
import { useSnapScroll } from "@/hooks/animation/useSnapScroll";
import { AboutUsData } from "@/types/aboutUs";
import Image from "next/image";
import Link from "next/link";
import MouseBouncing from "./MouseBouncing";

interface AboutUsClientProps {
  data: AboutUsData;
}

export default function AboutUsClient({ data }: AboutUsClientProps) {
  // Dua zona snap terpisah; area di antara keduanya (Susunan Redaksi)
  // serta area di bawah Zone 2 (Kontak, Alamat, Footer) bebas di-scroll.
  const zone1Ref = useSnapScroll();
  const zone2Ref = useSnapScroll();

  // Normalize misi: jika ada baris baru, jadikan list item; jika tidak, jadikan paragraf biasa
  const misiLines = data.misi
    ? data.misi.split("\n").filter((line) => line.trim().length > 0)
    : [];

  // Tentukan apakah ada data redaksi untuk ditampilkan
  const hasRedaksi = data.redaksiPositions && data.redaksiPositions.length > 0;

  // Tentukan apakah ada data kontak untuk ditampilkan
  const hasContact =
    data.email ||
    data.phone ||
    data.instagramLink ||
    data.facebookLink ||
    data.twitterLink;

  return (
    <div>
      <main className="min-h-screen bg-background">
        {/* ── ZONA SNAP 1: Hero · About Us · Visi · Misi ──────────────── */}
        <div ref={zone1Ref} className="relative">
          {/* snap-panel 1: Hero */}
          <section className="snap-panel h-screen w-full bg-background container mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8 flex items-center">
            <div className="flex flex-col gap-8 items-center justify-center pointer-events-none z-10 w-full">
              <Image
                src="/logo-arasvara/main-logo/main-logo-hitam-gema.png"
                alt="Arasvara Monogram"
                className="h-12 md:h-20 lg:h-24 object-contain select-none"
                draggable={false}
                unoptimized
                width={500}
                height={500}
              />
              {data.tagline && (
                <p className="text-foreground/90 text-center text-xl md:text-2xl font-medium">
                  {data.tagline}
                </p>
              )}
              {data.subTagline && (
                <p className="text-foreground/90 text-center text-xl md:text-2xl font-medium">
                  {data.subTagline}
                </p>
              )}
              {/* Fallback jika tidak ada tagline dari config */}
              {!data.tagline && !data.subTagline && (
                <>
                  <p className="text-foreground/90 text-center text-xl md:text-2xl font-medium">
                    is more than a brand. It is a vessel for voices
                  </p>
                  <p className="text-foreground/90 text-center text-xl md:text-2xl font-medium">
                    — a medium where stories flow without interruption, where
                    every word carries weight, and every sound matters.
                  </p>
                </>
              )}
            </div>

            <MouseBouncing variant="light" />
          </section>

          {/* snap-panel 2: About Us */}
          <SectionText title="About us" snapPanel variant="light">
            {data.aboutUsText ? (
              data.aboutUsText
                .split("\n\n")
                .filter((para) => para.trim().length > 0)
                .map((para, i) => (
                  <p key={i} className="text-base md:text-lg leading-relaxed">
                    {para}
                  </p>
                ))
            ) : (
              <>
                <p className="text-base md:text-lg leading-relaxed">
                  Seiring dengan pesatnya perkembangan zaman dan kemajuan
                  teknologi, industri media massa mengalami transformasi yang
                  signifikan. Di tengah dinamika tersebut serta kompetisi yang
                  semakin kompetitif, khususnya pada sektor media portal di
                  Indonesia, Arasvara hadir sebagai entitas media baru yang
                  berkomitmen menjawab tantangan dan kebutuhan industri.
                </p>
                <p className="text-base md:text-lg leading-relaxed">
                  Nama Arasvara lahir dari diskusi internal yang melibatkan
                  talenta muda. Media ini awalnya dirancang dengan nama Arah
                  Suara, kemudian dikembangkan menjadi Arasvara agar memiliki
                  identitas yang lebih modern, kuat, dan relevan bagi generasi
                  digital.
                </p>
              </>
            )}
          </SectionText>

          {/* snap-panel 3: Visi & Misi */}
          <section className="snap-panel min-h-screen overflow-hidden bg-background flex flex-col justify-center relative gap-8">
            <div className="container xl:max-w-6xl relative flex flex-col md:flex-row mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8 gap-8">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold w-full md:w-1/3 text-primary">
                Visi
              </h2>
              <div className="w-full md:w-2/3 space-y-2">
                <p className="text-base md:text-lg leading-relaxed">
                  {data.visi ||
                    "Menjadi media massa siber yang kredibel dan menjadi representasi suara generasi digital melalui penyajian konten yang akurat, inspiratif, serta memberdayakan."}
                </p>
              </div>
            </div>
            <DividerHorizontal variant="dark" className="mx-auto max-w-3xl" />
            <div className="container xl:max-w-6xl relative flex flex-col md:flex-row mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8 gap-8">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold w-full md:w-1/3 text-primary">
                Misi
              </h2>
              <div className="w-full md:w-2/3 space-y-2">
                {misiLines.length > 1 ? (
                  // Jika misi mengandung baris-baris terpisah, tampilkan sebagai list
                  <ul className="text-base md:text-lg leading-relaxed list-disc space-y-2 pl-6 md:pl-8 marker:text-primary">
                    {misiLines.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-base md:text-lg leading-relaxed">
                    {data.misi ||
                      "Menyampaikan informasi berkualitas yang relevan bagi kebutuhan dan dinamika generasi muda."}
                  </p>
                )}
              </div>
            </div>
            <MouseBouncing variant="dark" />
          </section>
        </div>
        {/* ── AKHIR ZONA SNAP 1 ────────────────────────────────────────── */}

        {/* ── FREE SCROLL: Susunan Redaksi & Manajemen ─────────────────── */}

        {/* Gradasi lembut dari background ke foreground sebagai transisi */}
        <div
          className="h-64 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, var(--background) 0%, var(--background) 75%, color-mix(in oklch, var(--foreground) 20%, var(--background)) 80%, var(--foreground) 100%)",
          }}
        />

        {hasRedaksi && (
          <section className="relative overflow-hidden flex items-center py-24">
            <Image
              src="https://images.unsplash.com/photo-1515378791036-0648a3ef77b2"
              fill
              unoptimized
              className="absolute inset-0 w-full h-full object-cover object-center z-0"
              alt="Arasvara Background"
              priority
            />
            <div className="absolute inset-0 bg-black/50 z-10" />
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-64 z-10 pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(to bottom, var(--foreground) 0%, color-mix(in oklch, var(--foreground) 60%, transparent) 40%, transparent 100%)",
              }}
            />

            <div
              className="container xl:max-w-6xl relative z-20 mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8"
              id="struktur-redaksi"
            >
              <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md shadow-lg p-6">
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 md:mb-8 text-center">
                  {data.titleRedaksi || "Susunan Redaksi & Manajemen"}
                </h2>

                <DividerHorizontal variant="light" />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {data.redaksiPositions.map((posItem) => (
                    <div
                      key={posItem.id}
                      className="rounded-2xl border border-white/20 bg-white/10 p-4"
                    >
                      <p className="text-sm md:text-base uppercase tracking-widest text-white/80 mb-4">
                        {posItem.position}
                      </p>
                      <div className="space-y-2">
                        {posItem.people.map((person) => (
                          <p
                            key={person.id}
                            className="text-lg md:text-xl font-bold text-white"
                          >
                            {person.name}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-64 z-10 pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(to bottom, transparent 0%, color-mix(in oklch, var(--foreground) 60%, transparent) 60%, var(--foreground) 100%)",
              }}
            />
          </section>
        )}

        {/* ── ZONA SNAP 2: Sections CTA · Quotes ──────────────────────── */}
        <div ref={zone2Ref} className="relative">
          {/* Render setiap section CTA dari konfigurasi admin sebagai snap-panel */}
          {data.sections.length > 0 ? (
            <section className="snap-panel h-screen overflow-hidden bg-foreground flex flex-col justify-center relative gap-12 md:gap-16 xl:gap-24">
              {data.sections.map((section, idx) => {
                const isExternalLink = section.link_button
                  ? /^https?:\/\//i.test(section.link_button)
                  : false;

                return (
                  <div
                    key={idx}
                    className="container xl:max-w-6xl relative flex flex-col md:flex-row mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8 gap-8"
                  >
                    {section.title && (
                      <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold w-full md:w-1/3 text-background">
                        {section.title}
                      </h2>
                    )}
                    <div className="w-full md:w-2/3 space-y-2">
                      {section.description && (
                        <p className="text-base md:text-lg leading-relaxed text-background/75 mb-8">
                          {section.description}
                        </p>
                      )}
                      {section.link_button && section.button_text && (
                        <Button variant="outline" size="lg" className="w-fit">
                          <Link
                            href={section.link_button}
                            {...(isExternalLink
                              ? {
                                  target: "_blank",
                                  rel: "noopener noreferrer",
                                }
                              : {})}
                          >
                            {section.button_text}
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
              <MouseBouncing variant="light" />
            </section>
          ) : (
            // Fallback: tampilkan Pedoman & Ketentuan hardcoded jika belum ada sections dari config
            // <section className="snap-panel h-screen overflow-hidden bg-foreground flex flex-col justify-center relative gap-8">
            //   <div className="container xl:max-w-6xl relative flex flex-col md:flex-row mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8 gap-8">
            //     <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold w-full md:w-1/3 text-background">
            //       Pedoman Media Siber
            //     </h2>
            //     <div className="w-full md:w-2/3 space-y-2">
            //       <p className="text-base md:text-lg leading-relaxed text-background/75 mb-8">
            //         Sebagai representasi suara generasi digital, integritas
            //         adalah prioritas utama kami. Seluruh tata kelola redaksi
            //         Arasvara berpedoman pada aturan Dewan Pers untuk memastikan
            //         informasi yang kamu terima selalu akurat, berimbang, dan
            //         dapat dipertanggungjawabkan.
            //       </p>
            //       <Button variant="outline" size="lg" className="w-fit">
            //         <Link href="/inside/pedoman-media-siber">
            //           Baca Pedoman Media Siber
            //         </Link>
            //       </Button>
            //     </div>
            //   </div>
            //   <DividerHorizontal
            //     variant="light"
            //     className="mx-auto max-w-3xl"
            //   />
            //   <div className="container xl:max-w-6xl relative flex flex-col md:flex-row mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8 gap-8">
            //     <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold w-full md:w-1/3 text-background">
            //       Ketentuan Konten
            //     </h2>
            //     <div className="w-full md:w-2/3 space-y-2">
            //       <p className="text-base md:text-lg leading-relaxed text-background/75 mb-8">
            //         Seluruh konten yang dipublikasikan pada platform Arasvara
            //         disediakan untuk tujuan informasi umum, edukasi, dan
            //         referensi. Artikel opini atau ulasan berbasis perspektif
            //         merupakan pandangan pribadi penulis dan tidak selalu
            //         mencerminkan sikap resmi redaksi.
            //       </p>
            //       <Button variant="outline" size="lg" className="w-fit">
            //         <Link href="/inside/ketentuan-konten">
            //           Baca Ketentuan Konten
            //         </Link>
            //       </Button>
            //     </div>
            //   </div>
            //   <MouseBouncing variant="light" />
            // </section>
            <></>
          )}

          {/* snap-panel: Quotes */}
          {(data.quotes || data.quotesOwner) && (
            <section className="snap-panel h-screen overflow-hidden bg-foreground flex items-center">
              <div className="container xl:max-w-6xl text-center mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8">
                <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold text-background text-center mb-4">
                  &ldquo;{data.quotes}&rdquo;
                </h3>
                {data.quotesOwner && (
                  <p className="text-background/75 text-center md:text-xl">
                    {data.quotesOwner}
                  </p>
                )}
              </div>
              <MouseBouncing variant="light" />
            </section>
          )}

          {/* Fallback quotes jika tidak ada dari config */}
          {!data.quotes && !data.quotesOwner && (
            <section className="snap-panel h-screen overflow-hidden bg-foreground flex items-center">
              <div className="container xl:max-w-6xl text-center mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8">
                <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold text-background text-center mb-4">
                  &ldquo;Arasvara hadir untuk menjadi suara yang mendengar dan
                  memantulkan aspirasi generasi muda.&rdquo;
                </h3>
              </div>
              <MouseBouncing variant="light" />
            </section>
          )}
        </div>
        {/* ── AKHIR ZONA SNAP 2 ────────────────────────────────────────── */}

        {/* ── FREE SCROLL: Kontak · Alamat · Footer ────────────────────── */}

        {hasContact && (
          <section className="relative overflow-hidden flex items-center py-24">
            <Image
              src="https://images.unsplash.com/photo-1515378791036-0648a3ef77b2"
              fill
              unoptimized
              className="absolute inset-0 w-full h-full object-cover object-center z-0"
              alt="Arasvara Background"
              priority
            />
            <div className="absolute inset-0 bg-black/50 z-10" />
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-64 z-10 pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(to bottom, var(--foreground) 0%, color-mix(in oklch, var(--foreground) 60%, transparent) 40%, transparent 100%)",
              }}
            />

            <div className="container xl:max-w-6xl relative z-20 mx-auto w-full min-w-0 px-4 md:px-6 lg:px-8">
              <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md shadow-lg p-6">
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white text-center mb-4">
                  {data.titleMeetUs || "Meet us"}
                </h2>
                {data.descMeetUs && (
                  <p className="text-base md:text-lg leading-relaxed text-white/75 mb-6 md:mb-8 text-center">
                    {data.descMeetUs}
                  </p>
                )}
                {!data.descMeetUs && (
                  <p className="text-base md:text-lg leading-relaxed text-white/75 mb-6 md:mb-8 text-center">
                    Kami sangat terbuka terhadap kritik, saran, maupun potensi
                    kerja sama. Silakan hubungi atau kunjungi kantor kami pada
                    jam kerja operasional:
                  </p>
                )}

                <DividerHorizontal variant="light" />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {data.email && (
                    <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                      <p className="text-sm md:text-base uppercase tracking-widest text-white/80 mb-4">
                        Email
                      </p>
                      <Link
                        href={`mailto:${data.email}`}
                        className="text-lg md:text-xl font-bold text-white hover:underline"
                      >
                        {data.email}
                      </Link>
                    </div>
                  )}
                  {data.phone && (
                    <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                      <p className="text-sm md:text-base uppercase tracking-widest text-white/80 mb-4">
                        Telepon
                      </p>
                      <p className="text-lg md:text-xl font-bold text-white">
                        {data.phone}
                      </p>
                    </div>
                  )}
                  {data.fax && (
                    <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                      <p className="text-sm md:text-base uppercase tracking-widest text-white/80 mb-4">
                        Fax
                      </p>
                      <p className="text-lg md:text-xl font-bold text-white">
                        {data.fax}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-64 z-10 pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(to bottom, transparent 0%, color-mix(in oklch, var(--foreground) 60%, transparent) 60%, var(--foreground) 100%)",
              }}
            />
          </section>
        )}

        {/* Alamat */}
        {data.address && (
          <SectionText
            title="Alamat"
            variant="dark"
            hideIconMouseBouncing={true}
          >
            <p className="text-base md:text-lg leading-relaxed text-background/75 mb-1">
              {data.email && `Email: ${data.email}`}
            </p>
            {data.phone && (
              <p className="text-base md:text-lg leading-relaxed text-background/75 mb-1">
                Telepon: {data.phone}
              </p>
            )}
            {data.fax && (
              <p className="text-base md:text-lg leading-relaxed text-background/75 mb-1">
                Fax: {data.fax}
              </p>
            )}
            <p className="text-base md:text-lg leading-relaxed text-background/75 mb-8">
              {data.address}
            </p>
            {data.linkGmaps && (
              <Button
                variant="outline"
                size="lg"
                className="w-fit flex items-center gap-2"
              >
                <Link
                  href={data.linkGmaps}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Kunjungi Kami
                </Link>
              </Button>
            )}
          </SectionText>
        )}

        {/* Gradasi penutup ke Footer */}
        <div className="h-64 bg-linear-to-b from-foreground from-10% to-primary pointer-events-none" />
      </main>

      <Footer />
    </div>
  );
}
