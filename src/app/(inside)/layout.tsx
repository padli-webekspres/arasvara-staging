import Footer from "@/components/Footer";
import NavbarContainer from "@/components/navbar/NavbarContainer";
import NavbarInside from "@/components/navbar/NavbarInside";
import Image from "next/image";
import Link from "next/link";

export default function InsideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // get pathname di server komponen

  return (
    <div>
      {/* navbar khusus untuk halaman inside */}
      <NavbarInside />

      {children}
    </div>
  );
}
