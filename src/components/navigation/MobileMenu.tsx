"use client";

import { useEffect, type TransitionEvent } from "react";
import Link from "next/link";
import { X, Instagram, Linkedin, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NAV_LINKS } from "@/lib/constants";
import Image from "next/image";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buildAuthorPublicPath } from "@/lib/author-public-path";

interface MobileMenuProps {
  isOpen: boolean;
  isVisible: boolean;
  active: string | null;
  onClose: () => void;
  onExited: () => void;
}
const MobileMenu = ({
  isOpen,
  isVisible,
  active,
  onClose,
  onExited,
}: MobileMenuProps) => {
  const { data: userAuthed } = useCurrentUser();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handlePanelTransitionEnd = (
    event: TransitionEvent<HTMLDivElement>,
  ) => {
    if (event.propertyName !== "transform") return;
    if (!isOpen) {
      onExited();
    }
  };

  useEffect(() => {
    if (!isOpen) {
      const timeoutId = window.setTimeout(() => {
        onExited();
      }, 350);

      return () => window.clearTimeout(timeoutId);
    }
    return undefined;
  }, [isOpen, onExited]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-100 ${isOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        onClick={onClose}
      />

      {/* Menu Panel */}
      <div
        className={`absolute right-0 top-0 h-full w-full max-w-sm bg-background shadow-xl transition-transform duration-300 ease-out ${isOpen ? "translate-x-0 pointer-events-auto" : "translate-x-full pointer-events-none"
          }`}
        onTransitionEnd={handlePanelTransitionEnd}
      >
        <div className="flex flex-col h-full p-6">
          {/* Close Button */}
          <div className="flex justify-end mb-8">
            <button
              onClick={onClose}
              className="flex items-center space-x-2 text-sm font-medium hover:text-muted-foreground transition-colors"
            >
              <span>close</span>
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 space-y-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={onClose}
                className={`block text-right text-lg font-medium transition-colors ${active === link.name.toLowerCase()
                  ? "text-hijauSawah"
                  : "text-foreground hover:text-muted-foreground"
                  }`}
              >
                {link.name}
              </Link>
            ))}
            <Link
              href="/about"
              onClick={onClose}
              className="block text-right text-lg font-medium text-foreground hover:text-muted-foreground transition-colors"
            >
              About
            </Link>
          </nav>

          {/* Subscribe and Social */}
          <div>
            {userAuthed && userAuthed.slug && (
              <Link
                href={buildAuthorPublicPath(userAuthed.slug)}
                onClick={onClose}
                className="py-4 border-t border-border flex flex-row justify-start items-center gap-4 hover:bg-muted"
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage src={userAuthed?.avatar || undefined} />
                  <AvatarFallback>
                    {userAuthed?.name?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <p className="font-semibold text-lg">{userAuthed?.name}</p>
              </Link>
            )}
            {userAuthed && !userAuthed.slug && (
              <div className="py-4 border-t border-border flex flex-row justify-start items-center gap-4">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={userAuthed?.avatar || undefined} />
                  <AvatarFallback>
                    {userAuthed?.name?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <p className="font-semibold text-lg">{userAuthed?.name}</p>
              </div>
            )}

            <div className="pt-8 border-t border-border">
              <div className="flex items-center justify-between mb-6">
                <Image
                  src="/logo-arasvara/main-logo/main-logo-hitam-gema.png"
                  alt="Arasvara Logo"
                  width={200}
                  height={80}
                />
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Subscribe
                </Button>
              </div>

              <div className="flex justify-center space-x-4">
                <a
                  href="#"
                  className="p-2 rounded-full border border-border hover:border-foreground transition-colors"
                >
                  <Instagram className="h-5 w-5" />
                </a>
                <a
                  href="#"
                  className="p-2 rounded-full border border-border hover:border-foreground transition-colors"
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579 1.205-6.332 3.509-8.182C6.926 1.999 10.58 1.5 14.23 1.5h.017c3.581.03 6.334 1.205 8.184 3.509 1.645 2.05 2.495 4.904 2.522 8.48v.017c-.03 3.579-1.205 6.332-3.509 8.182-2.05 1.813-4.693 2.663-7.86 2.531zm.014-1.667c2.813.092 4.987-.589 6.476-2.025 1.489-1.437 2.234-3.611 2.25-6.308-.018-2.698-.763-4.872-2.253-6.309-1.489-1.437-3.664-2.117-6.477-2.025-2.813-.092-4.987.589-6.476 2.025-1.489 1.437-2.234 3.611-2.25 6.308.018 2.698.763 4.872 2.253 6.309 1.489 1.437 3.664 2.117 6.477 2.025zm3.47-14.166h-3.5v12.5h-3.5v-12.5h-3.5V5h10.5v3.167z" />
                  </svg>
                </a>
                <a
                  href="#"
                  className="p-2 rounded-full border border-border hover:border-foreground transition-colors"
                >
                  <Linkedin className="h-5 w-5" />
                </a>
                <a
                  href="#"
                  className="p-2 rounded-full border border-border hover:border-foreground transition-colors"
                >
                  <Twitter className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileMenu;
