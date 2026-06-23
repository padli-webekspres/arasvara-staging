"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import Navbar from "./Navbar";
import MobileMenu from "./MobileMenu";

export default function NavContainer() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const params = useParams();
  // cek apakah sedang dihalaman category atau article
  const isCategoryPage = params.category !== undefined;
  const categorySlug = isCategoryPage ? params.category : null;
  const categorySlugString =
    typeof categorySlug === "string" ? categorySlug : String(categorySlug);

  const handleOpenMenu = () => {
    setIsMenuVisible(true);
    requestAnimationFrame(() => {
      setIsMenuOpen(true);
    });
  };

  const handleCloseMenu = () => {
    setIsMenuOpen(false);
  };

  const handleMenuExited = () => {
    setIsMenuVisible(false);
  };

  return (
    <>
      <Navbar
        active={categorySlugString}
        onMenuOpen={handleOpenMenu}
      />
      <MobileMenu
        active={categorySlugString}
        isOpen={isMenuOpen}
        isVisible={isMenuVisible}
        onClose={handleCloseMenu}
        onExited={handleMenuExited}
      />
    </>
  );
}
