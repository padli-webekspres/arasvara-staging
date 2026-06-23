/**
 * Layout untuk route group (public).
 *
 * Ini adalah Server Component (tidak ada "use client") agar:
 * 1. Metadata dari child page.tsx bisa di-cascade dengan benar oleh Next.js
 * 2. Rendering awal lebih cepat — layout di-render di server, bukan di browser
 *
 * Komponen child seperti NavbarContainer, Footer, dan PushSubscriber
 * adalah Client Components sendiri, sehingga tetap berfungsi normal
 * ketika di-render di dalam Server Component layout ini.
 */

import Footer from "@/components/Footer";
import NavbarContainer from "@/components/navbar/NavbarContainer";
import React from "react";

interface PublicLayoutProps {
  children: React.ReactNode;
}

const PublicLayout = ({ children }: PublicLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <NavbarContainer />

      {children}

      <Footer />
    </div>
  );
};

export default PublicLayout;
