/**
 * Layout untuk route group (public).
 *
 * Ini adalah Server Component (tidak ada "use client") agar:
 * 1. Metadata dari child page.tsx bisa di-cascade dengan benar oleh Next.js
 * 2. Rendering awal lebih cepat — layout di-render di server, bukan di browser
 *
 * NavbarContainer adalah Client Component; FooterView di-render di server
 * dengan data konfigurasi dari DB (bukan self-fetch HTTP).
 */

import FooterView from "@/components/FooterView";
import NavbarContainer from "@/components/navbar/NavbarContainer";
import React from "react";
import { cookies } from "next/headers";
import { getPublicStorageOrigins } from "@/lib/storage-origins";
import { cookieJarHasAuthSession } from "@/lib/auth-config";
import { getFooterViewPropsFromDb } from "@/lib/server/fetchServerSide";

interface PublicLayoutProps {
  children: React.ReactNode;
}

const PublicLayout = async ({ children }: PublicLayoutProps) => {
  const storageOrigins = getPublicStorageOrigins();
  const cookieStore = await cookies();
  const hasAuthSession = cookieJarHasAuthSession(
    (name) => cookieStore.get(name)?.value,
  );
  const footerProps = await getFooterViewPropsFromDb();

  return (
    <>
      {storageOrigins.map((origin) => (
        <link
          key={origin}
          rel="preconnect"
          href={origin}
          crossOrigin="anonymous"
        />
      ))}
      <div className="min-h-screen bg-background">
        <NavbarContainer hasAuthSession={hasAuthSession} />

        {children}

        <FooterView {...footerProps} />
      </div>
    </>
  );
};

export default PublicLayout;
